import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { rangoDesdeParams } from "@/lib/fechas";
import type { EstadoCaso } from "@/types";

// Exporta los casos que coinciden con los filtros activos (búsqueda, estado y rango de fechas) en
// CSV (por defecto) o Excel (?formato=xlsx). Con ?resumen=1 el Excel agrega una hoja "Resumen" con
// los agregados que muestra /reportes (por estado, carrera, institución y día). El acceso ya está
// restringido a admin por el middleware (la ruta cuelga de /casos). No se pagina: trae todo lo que
// cumple el filtro.

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

const ENCABEZADOS = [
  "Solicitante",
  "Correo",
  "Celular",
  "Institución de origen",
  "Carrera destino",
  "Estado",
  "Semestre sugerido",
  "Fecha",
];

function valoresDeFila(f: Fila): (string | number | null)[] {
  return [
    f.solicitante_nombre ?? "Invitado",
    f.solicitante_correo,
    f.solicitante_celular,
    f.institucion_origen_nombre,
    f.pensum?.carrera ?? "",
    ETIQUETA_ESTADO[f.estado],
    f.semestre_sugerido,
    fechaLegible(f.creado_en),
  ];
}

function responderCsv(filas: Fila[], hoy: string): Response {
  // Separador ';' para que Excel en español lo abra en columnas; BOM para que respete los acentos.
  const lineas = [
    ENCABEZADOS.map(celda).join(";"),
    ...filas.map((f) => valoresDeFila(f).map(celda).join(";")),
  ];
  const csv = "﻿" + lineas.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casos-${hoy}.csv"`,
    },
  });
}

// Agrupa y cuenta por una clave; devuelve pares ordenados de mayor a menor.
function contarPor(filas: Fila[], clave: (f: Fila) => string): [string, number][] {
  const conteo = new Map<string, number>();
  for (const f of filas) {
    const k = clave(f) || "—";
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1]);
}

function estilarEncabezado(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  fila.alignment = { vertical: "middle" };
  fila.height = 20;
}

async function responderXlsx(filas: Fila[], conResumen: boolean, hoy: string): Promise<Response> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Homologaciones";
  libro.created = new Date();

  const hojaCasos = libro.addWorksheet("Casos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hojaCasos.columns = [
    { header: ENCABEZADOS[0], key: "solicitante", width: 28 },
    { header: ENCABEZADOS[1], key: "correo", width: 30 },
    { header: ENCABEZADOS[2], key: "celular", width: 15 },
    { header: ENCABEZADOS[3], key: "institucion", width: 34 },
    { header: ENCABEZADOS[4], key: "carrera", width: 30 },
    { header: ENCABEZADOS[5], key: "estado", width: 13 },
    { header: ENCABEZADOS[6], key: "semestre", width: 10 },
    { header: ENCABEZADOS[7], key: "fecha", width: 18 },
  ];
  for (const f of filas) {
    hojaCasos.addRow(valoresDeFila(f));
  }
  estilarEncabezado(hojaCasos);
  hojaCasos.autoFilter = { from: "A1", to: "H1" };

  if (conResumen) {
    const hoja = libro.addWorksheet("Resumen");
    hoja.columns = [
      { width: 40 },
      { width: 12 },
    ];

    const seccion = (titulo: string, pares: [string, number][]) => {
      const filaTitulo = hoja.addRow([titulo]);
      filaTitulo.font = { bold: true, size: 12 };
      for (const [nombre, cantidad] of pares) {
        hoja.addRow([nombre, cantidad]);
      }
      hoja.addRow([]);
    };

    hoja.addRow([`Total de casos: ${filas.length}`]).font = { bold: true, size: 13 };
    hoja.addRow([]);
    seccion("Por estado", contarPor(filas, (f) => ETIQUETA_ESTADO[f.estado]));
    seccion("Por carrera destino", contarPor(filas, (f) => f.pensum?.carrera ?? ""));
    seccion("Por institución de origen", contarPor(filas, (f) => f.institucion_origen_nombre));
    seccion(
      "Por día",
      contarPor(filas, (f) =>
        new Intl.DateTimeFormat("es", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
          new Date(f.creado_en),
        ),
      ),
    );
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="casos-${hoy}.xlsx"`,
    },
  });
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

  const hoy = new Date().toISOString().slice(0, 10);
  if (sp.get("formato") === "xlsx") {
    return responderXlsx(filas, sp.get("resumen") === "1", hoy);
  }
  return responderCsv(filas, hoy);
}
