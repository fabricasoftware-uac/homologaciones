import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { sitioUrl } from "@/lib/sitio";
import type { EstadoCaso } from "@/types";
import { generarActaPdf, type DatosActa, type FilaActa } from "./documento";

// Carga y ensamblado de datos para el acta de homologación. Lo comparten las dos rutas que la
// generan: /casos/[id]/acta (admin, cliente con sesión) y /seguimiento/[token]/acta (estudiante,
// cliente de servicio). Por eso recibe el cliente de Supabase ya construido y la fila del caso.

export type CasoActa = {
  id: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  nota_admin: string | null;
  token_seguimiento: string;
  solicitante_nombre: string | null;
  institucion_origen_nombre: string;
  pensum: { carrera: string } | null;
};

// Columnas que las rutas deben pedir del caso para armar el acta.
export const SELECCION_CASO_ACTA =
  "id, estado, semestre_sugerido, nota_admin, token_seguimiento, solicitante_nombre, institucion_origen_nombre, pensum:pensum_destino_id (carrera)";

// Materias homologadas (vínculos aprobados) ordenadas por semestre de la asignatura destino.
export async function cargarHomologacionesAprobadas(
  supabase: SupabaseClient,
  casoId: string,
): Promise<FilaActa[]> {
  const { data } = await supabase
    .from("vinculo")
    .select(
      "materia_origen:materia_origen_id (nombre, creditos), asignatura:asignatura_id (nombre, semestre, creditos)",
    )
    .eq("caso_id", casoId)
    .eq("estado", "aprobado");

  const filas = (data ?? []) as unknown as {
    materia_origen: { nombre: string; creditos: number | null } | null;
    asignatura: { nombre: string; semestre: number; creditos: number } | null;
  }[];

  return filas
    .map((v) => ({
      materia: v.materia_origen?.nombre ?? "—",
      asignatura: v.asignatura?.nombre ?? "—",
      creditos: v.asignatura?.creditos ?? 0,
      semestre: v.asignatura?.semestre ?? 99,
    }))
    .sort((a, b) => a.semestre - b.semestre || a.asignatura.localeCompare(b.asignatura, "es"))
    .map(({ materia, asignatura, creditos }) => ({ materia, asignatura, creditos }));
}

// Folio legible del acta a partir del token de seguimiento (primeros 8 caracteres en mayúscula).
function folioDe(token: string): string {
  return token.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Arma el acta y la devuelve como respuesta PDF. Solo se emite para casos APROBADOS; en cualquier
// otro estado responde 400. Lo usan ambas rutas (admin y estudiante).
export async function responderActa(
  supabase: SupabaseClient,
  caso: CasoActa,
): Promise<Response> {
  if (caso.estado !== "aprobado") {
    return new Response("El acta solo está disponible para homologaciones aprobadas.", {
      status: 400,
    });
  }

  const [homologaciones, marca] = await Promise.all([
    cargarHomologacionesAprobadas(supabase, caso.id),
    obtenerConfiguracion(),
  ]);

  // QR de verificación: apunta a la página pública de seguimiento del caso (por token). Un tercero
  // escanea el acta y confirma su autenticidad. Best-effort: si falla, el acta sale sin QR.
  const urlVerificacion = `${sitioUrl()}/seguimiento/${caso.token_seguimiento}`;
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(urlVerificacion, { margin: 1, width: 240 });
  } catch (error) {
    console.error("[acta] No se pudo generar el QR de verificación", error);
  }

  const datos: DatosActa = {
    institucion: marca.nombre,
    marcaColor: marca.colorPrimario,
    folio: folioDe(caso.token_seguimiento),
    fecha: new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    solicitante: caso.solicitante_nombre?.trim() || "Estudiante",
    institucionOrigen: caso.institucion_origen_nombre,
    carrera: caso.pensum?.carrera ?? "—",
    semestre: caso.semestre_sugerido,
    nota: caso.nota_admin,
    homologaciones,
    qr,
    urlVerificacion,
  };

  const pdf = await generarActaPdf(datos);
  const nombreArchivo = `acta-homologacion-${folioDe(caso.token_seguimiento)}.pdf`;

  // Convertimos el Buffer de Node a Uint8Array: es lo que aceptan los tipos de Response como cuerpo.
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
