import { NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { rangoDesdeParams } from "@/lib/fechas";
import type { EstadoCaso } from "@/types";

// Exporta a CSV los casos que coinciden con los filtros activos de la bandeja (búsqueda, estado y
// rango de fechas). El acceso ya está restringido a admin por el middleware (la ruta cuelga de
// /casos). No se pagina: trae todo lo que cumple el filtro.

const ESTADOS_VALIDOS: EstadoCaso[] = ["procesando", "en_revision", "aprobado", "rechazado"];

const ETIQUETA_ESTADO: Record<EstadoCaso, string> = {
  procesando: "Procesando",
  en_revision: "Por revisar",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

type Fila = {
  solicitante_nombre: string | null;
  solicitante_correo: string | null;
  solicitante_celular: string | null;
  institucion_origen_nombre: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  creado_en: string;
  pensum: { carrera: string } | null;
};

// Escapa un valor para CSV: lo envuelve en comillas y duplica las comillas internas.
function celda(valor: string | number | null): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function fechaLegible(iso: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params = {
    periodo: sp.get("periodo") ?? undefined,
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
  };
  const rango = rangoDesdeParams(params);

  const termino = (sp.get("q") ?? "").replace(/[,()]/g, " ").trim();
  const orTexto = termino
    ? `solicitante_nombre.ilike.%${termino}%,solicitante_correo.ilike.%${termino}%,institucion_origen_nombre.ilike.%${termino}%`
    : null;
  const estadoParam = sp.get("estado");
  const estadoFiltro = ESTADOS_VALIDOS.includes(estadoParam as EstadoCaso)
    ? (estadoParam as EstadoCaso)
    : null;

  const supabase = crearClienteServidor();
  let consulta = supabase
    .from("caso")
    .select(
      "solicitante_nombre, solicitante_correo, solicitante_celular, institucion_origen_nombre, estado, semestre_sugerido, creado_en, pensum:pensum_destino_id (carrera)",
    )
    .order("creado_en", { ascending: false });
  if (rango.desde) consulta = consulta.gte("creado_en", rango.desde);
  if (rango.hasta) consulta = consulta.lte("creado_en", rango.hasta);
  if (orTexto) consulta = consulta.or(orTexto);
  if (estadoFiltro) consulta = consulta.eq("estado", estadoFiltro);

  const { data } = await consulta;
  const filas = (data ?? []) as unknown as Fila[];

  const encabezados = [
    "Solicitante",
    "Correo",
    "Celular",
    "Institución de origen",
    "Carrera destino",
    "Estado",
    "Semestre sugerido",
    "Fecha",
  ];

  // Separador ';' para que Excel en español lo abra en columnas; BOM para que respete los acentos.
  const lineas = [
    encabezados.map(celda).join(";"),
    ...filas.map((f) =>
      [
        celda(f.solicitante_nombre ?? "Invitado"),
        celda(f.solicitante_correo),
        celda(f.solicitante_celular),
        celda(f.institucion_origen_nombre),
        celda(f.pensum?.carrera ?? ""),
        celda(ETIQUETA_ESTADO[f.estado]),
        celda(f.semestre_sugerido),
        celda(fechaLegible(f.creado_en)),
      ].join(";"),
    ),
  ];
  const csv = "﻿" + lineas.join("\r\n");

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casos-${hoy}.csv"`,
    },
  });
}
