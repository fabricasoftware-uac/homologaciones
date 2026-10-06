import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import type { EstadoCaso } from "@/types";
import {
  generarActaPdf,
  formatearCursoCapitalizado,
  type DatosResolucion,
  type FilaHomologada,
  type FilaCursoMatricula,
} from "./documento";
import { proyectarCursosAutomaticos, type AsignaturaProyeccion } from "./proyeccion-matricula";

export type CasoActa = {
  id: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  nota_admin: string | null;
  token_seguimiento: string;
  solicitante_nombre: string | null;
  solicitante_cedula: string | null;
  solicitante_lugar_exp: string | null;
  institucion_origen_nombre: string;
  programa_origen_nombre: string | null;
  numero_resolucion: string | null;
  periodo_matricula: string | null;
  fecha_limite_pago: string | null;
  folios_solicitud: number | null;
  folios_certificado: number | null;
  folios_contenidos: number | null;
  creado_en: string;
  decidido_en: string | null;
  pensum_destino_id: string;
  pensum: { carrera: string; resolucion_men?: string | null } | null;
};

export const SELECCION_CASO_ACTA =
  "id, estado, semestre_sugerido, nota_admin, token_seguimiento, solicitante_nombre, solicitante_cedula, solicitante_lugar_exp, institucion_origen_nombre, programa_origen_nombre, numero_resolucion, periodo_matricula, fecha_limite_pago, folios_solicitud, folios_certificado, folios_contenidos, creado_en, decidido_en, pensum_destino_id, pensum:pensum_destino_id (carrera, resolucion_men)";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DIAS_LETRAS: Record<number, string> = {
  1: "un", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
  6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
  11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
  16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
  21: "veintiún", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro", 25: "veinticinco",
  26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve", 30: "treinta",
  31: "treinta y un",
};

function formatearFechaEncabezado(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `(${dia} de ${mes} de ${anio})`;
}

function formatearFechaNotificacion(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} de ${mes} de ${anio}`;
}

function formatearFechaLegalCierre(fecha: Date): string {
  const diaNum = fecha.getDate();
  const diaTexto = DIAS_LETRAS[diaNum] || String(diaNum);
  const diaPad = String(diaNum).padStart(2, "0");
  const mes = MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  const anioTexto = anio === 2026 ? "dos mil veintiséis" : anio === 2025 ? "dos mil veinticinco" : `${anio}`;

  return `Popayán, a los ${diaTexto} (${diaPad}) días del mes de ${mes} de ${anioTexto} (${anio})`;
}

export async function cargarHomologacionesAprobadas(
  supabase: SupabaseClient,
  casoId: string,
): Promise<FilaHomologada[]> {
  const { data } = await supabase
    .from("vinculo")
    .select(
      "materia_origen:materia_origen_id (nombre, nota, creditos), asignatura:asignatura_id (codigo, nombre, semestre, creditos)",
    )
    .eq("caso_id", casoId)
    .eq("estado", "aprobado");

  const filas = (data ?? []) as unknown as {
    materia_origen: { nombre: string; nota: string | null; creditos: number | null } | null;
    asignatura: { codigo: string | null; nombre: string; semestre: number; creditos: number } | null;
  }[];

  return filas
    .map((v) => {
      const cr = v.asignatura?.creditos ?? 0;
      return {
        materiaOrigen: formatearCursoCapitalizado(v.materia_origen?.nombre) || "—",
        codigoUniautonoma: v.asignatura?.codigo ?? "—",
        nombreAsignatura: v.asignatura?.nombre ?? "—",
        semestre: v.asignatura?.semestre ?? 1,
        creditos: cr,
        intensidadHoraria: cr > 0 ? cr * 48 : "—",
        tipo: "TP",
        calificacion: v.materia_origen?.nota?.trim() || "Aprobado",
      };
    })
    .sort((a, b) => a.semestre - b.semestre || a.nombreAsignatura.localeCompare(b.nombreAsignatura, "es"));
}

export async function cargarCursosMatricula(
  supabase: SupabaseClient,
  caso: CasoActa,
  homologadas: FilaHomologada[],
): Promise<FilaCursoMatricula[]> {
  // 1. Intentar cargar cursos registrados explícitamente en curso_matricula
  const { data: registrados } = await supabase
    .from("curso_matricula")
    .select("orden, asignatura:asignatura_id (codigo, nombre, semestre, creditos)")
    .eq("caso_id", caso.id)
    .order("orden");

  const filasRegistradas = (registrados ?? []) as unknown as {
    orden: number;
    asignatura: { codigo: string | null; nombre: string; semestre: number; creditos: number } | null;
  }[];

  if (filasRegistradas.length > 0) {
    return filasRegistradas.map((f, i) => {
      const cr = f.asignatura?.creditos ?? 0;
      return {
        no: f.orden || i + 1,
        codigo: f.asignatura?.codigo ?? "—",
        curso: f.asignatura?.nombre ?? "—",
        semestre: f.asignatura?.semestre ?? 1,
        creditos: cr,
        intensidadHoraria: cr > 0 ? cr * 48 : "—",
        tipo: "TP",
      };
    });
  }

  // 2. Si no hay cursos guardados, proyectar automáticamente según las reglas académicas
  const { data: asignaturasPensum } = await supabase
    .from("asignatura")
    .select("id, codigo, nombre, semestre, creditos")
    .eq("pensum_id", caso.pensum_destino_id)
    .order("semestre");

  const lista = (asignaturasPensum ?? []) as AsignaturaProyeccion[];

  const proyectadas = proyectarCursosAutomaticos(
    lista,
    { nombres: homologadas.map((h) => h.nombreAsignatura) },
    caso.semestre_sugerido ?? 1,
    6,
  );

  return proyectadas.map((a, i) => {
    const cr = a.creditos || 0;
    return {
      no: i + 1,
      codigo: a.codigo ?? "—",
      curso: a.nombre,
      semestre: a.semestre,
      creditos: cr,
      intensidadHoraria: cr > 0 ? cr * 48 : "—",
      tipo: "TP",
    };
  });
}

function folioDe(token: string): string {
  return token.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function responderActa(
  supabase: SupabaseClient,
  caso: CasoActa,
): Promise<Response> {
  if (caso.estado !== "aprobado") {
    return new Response(
      "La Resolución oficial solo se emite para homologaciones aprobadas.",
      { status: 400 },
    );
  }

  const [homologadas, marca] = await Promise.all([
    cargarHomologacionesAprobadas(supabase, caso.id),
    obtenerConfiguracion(),
  ]);

  const cursosMatricula = await cargarCursosMatricula(supabase, caso, homologadas);

  const fechaBase = caso.decidido_en ? new Date(caso.decidido_en) : new Date();

  // Fecha límite de pago legible
  let fechaLimitePagoTexto = "fijado en el calendario institucional";
  if (caso.fecha_limite_pago) {
    try {
      const f = new Date(`${caso.fecha_limite_pago}T12:00:00`);
      fechaLimitePagoTexto = `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
    } catch {
      fechaLimitePagoTexto = caso.fecha_limite_pago;
    }
  }

  const datos: DatosResolucion = {
    numeroResolucion: caso.numero_resolucion?.trim() || folioDe(caso.token_seguimiento),
    fechaResolucionEncabezado: formatearFechaEncabezado(fechaBase),
    fechaLegalCierre: formatearFechaLegalCierre(fechaBase),
    fechaNotificacion: formatearFechaNotificacion(fechaBase),
    solicitanteNombre: caso.solicitante_nombre?.trim() || "Aspirante",
    solicitanteCedula: caso.solicitante_cedula?.trim() || "—",
    solicitanteLugarExp: caso.solicitante_lugar_exp?.trim() || "Popayán",
    institucionOrigen: caso.institucion_origen_nombre,
    programaOrigen: caso.programa_origen_nombre?.trim() || "Programa Académico de Origen",
    carreraDestino: caso.pensum?.carrera ?? "Programa Destino",
    resolucionMen: caso.pensum?.resolucion_men?.trim() || "expedida por el Ministerio de Educación Nacional",
    homologaciones: homologadas,
    foliosSolicitud: caso.folios_solicitud || 1,
    foliosCertificado: caso.folios_certificado || 1,
    foliosContenidos: caso.folios_contenidos || null,
    periodoMatricula: caso.periodo_matricula?.trim() || "2026 (1P-2026)",
    cursosMatricula,
    fechaLimitePago: fechaLimitePagoTexto,
    coordinadorNombre: marca.coordinadorNombre?.trim() || "Coordinación de Programa",
    logoPath: path.join(process.cwd(), "public/resolucion/logo-uniautonoma.png"),
    vigiladoPath: path.join(process.cwd(), "public/resolucion/vigilado-mineducacion.png"),
  };

  const pdf = await generarActaPdf(datos);
  const numResol = caso.numero_resolucion?.trim() || folioDe(caso.token_seguimiento);
  const nombreArchivo = `Resolucion-Homologacion-${numResol}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
