import Link from "next/link";
import clsx from "clsx";
import {
  IconClock as Clock,
  IconAlertCircle as AlertCircle,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  IconInbox as Inbox,
  IconBriefcase as Briefcase,
  IconArrowRight as ArrowRight,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconDownload as Download,
  type Icon as LucideIcon,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import { TarjetaStat } from "@/components/tarjeta-stat";
import { FiltroFechas } from "@/components/filtro-fechas";
import { rangoDesdeParams } from "@/lib/fechas";
import type { EstadoCaso } from "@/types";
import { BotonEliminarCaso } from "./boton-eliminar";
import { BuscadorCasos } from "./buscador";

// Bandeja de casos del admin (datos reales, paginada, con búsqueda, filtro por estado y filtro de
// fechas). El acceso ya está restringido a admin por el middleware.

const PAGINA = 12;

// Días que un caso puede estar "por revisar" antes de marcarlo como demorado (SLA visual).
const SLA_DIAS = 3;

const ESTADO_UI: Record<EstadoCaso, { etiqueta: string; clases: string; Icono: LucideIcon }> = {
  procesando: { etiqueta: "Procesando", clases: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30", Icono: Clock },
  en_revision: { etiqueta: "Por revisar", clases: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30", Icono: AlertCircle },
  aprobado: { etiqueta: "Aprobado", clases: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30", Icono: CheckCircle2 },
  rechazado: { etiqueta: "Rechazado", clases: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30", Icono: XCircle },
};

// Orden y etiquetas de las pestañas de estado. "" = todos.
const ESTADOS_TAB: { clave: "" | EstadoCaso; label: string }[] = [
  { clave: "", label: "Todos" },
  { clave: "en_revision", label: "Por revisar" },
  { clave: "procesando", label: "Procesando" },
  { clave: "aprobado", label: "Aprobados" },
  { clave: "rechazado", label: "Rechazados" },
];

const ESTADOS_VALIDOS: EstadoCaso[] = ["procesando", "en_revision", "aprobado", "rechazado"];

type CasoFila = {
  id: string;
  institucion_origen_nombre: string;
  solicitante_nombre: string | null;
  estado: EstadoCaso;
  creado_en: string;
  pensum: { carrera: string } | null;
};

const SELECCION =
  "id, institucion_origen_nombre, solicitante_nombre, estado, creado_en, pensum:pensum_destino_id (carrera)";

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function PaginaCasos({
  searchParams,
}: {
  searchParams: { periodo?: string; desde?: string; hasta?: string; page?: string; q?: string; estado?: string };
}) {
  const rango = rangoDesdeParams(searchParams);
  const pagina = Math.max(1, Number(searchParams.page) || 1);
  const from = (pagina - 1) * PAGINA;
  const to = from + PAGINA - 1;

  // Término de búsqueda saneado: quitamos los caracteres que romperían la sintaxis de .or() de
  // PostgREST (comas y paréntesis) antes de armar el filtro ilike.
  const termino = (searchParams.q ?? "").replace(/[,()]/g, " ").trim();
  const orTexto = termino
    ? `solicitante_nombre.ilike.%${termino}%,solicitante_correo.ilike.%${termino}%,institucion_origen_nombre.ilike.%${termino}%`
    : null;

  const estadoFiltro = ESTADOS_VALIDOS.includes(searchParams.estado as EstadoCaso)
    ? (searchParams.estado as EstadoCaso)
    : null;

  const supabase = crearClienteServidor();

  // Página de la tabla: aplica fecha + texto + estado, ordena y pagina (con total para paginar).
  let qPagina = supabase.from("caso").select(SELECCION, { count: "exact" });
  if (rango.desde) qPagina = qPagina.gte("creado_en", rango.desde);
  if (rango.hasta) qPagina = qPagina.lte("creado_en", rango.hasta);
  if (orTexto) qPagina = qPagina.or(orTexto);
  if (estadoFiltro) qPagina = qPagina.eq("estado", estadoFiltro);

  // Conteos por estado para las pestañas: mismo filtro de fecha + texto, SIN el de estado (cada
  // pestaña cuenta lo suyo). Son head counts (solo el número).
  const conteoBuilders = ESTADOS_VALIDOS.map((clave) => {
    let b = supabase.from("caso").select("id", { count: "exact", head: true }).eq("estado", clave);
    if (rango.desde) b = b.gte("creado_en", rango.desde);
    if (rango.hasta) b = b.lte("creado_en", rango.hasta);
    if (orTexto) b = b.or(orTexto);
    return b;
  });

  const [resultado, ...conteos] = await Promise.all([
    qPagina.order("creado_en", { ascending: false }).range(from, to),
    ...conteoBuilders,
  ]);

  const casos = (resultado.data ?? []) as unknown as CasoFila[];
  const totalFiltrado = resultado.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGINA));

  // Conteos por estado y total (suma de todos los estados del rango/búsqueda).
  const porEstado = ESTADOS_VALIDOS.reduce(
    (acc, clave, i) => ({ ...acc, [clave]: conteos[i].count ?? 0 }),
    {} as Record<EstadoCaso, number>,
  );
  const total = ESTADOS_VALIDOS.reduce((s, clave) => s + porEstado[clave], 0);

  // Construye una URL conservando los filtros actuales, con los cambios indicados.
  function hrefCon(cambios: { estado?: string | null; page?: number }, base = "/casos") {
    const sp = new URLSearchParams();
    if (searchParams.periodo) sp.set("periodo", searchParams.periodo);
    if (searchParams.desde) sp.set("desde", searchParams.desde);
    if (searchParams.hasta) sp.set("hasta", searchParams.hasta);
    if (searchParams.q) sp.set("q", searchParams.q);
    const estado = "estado" in cambios ? cambios.estado : searchParams.estado;
    if (estado) sp.set("estado", estado);
    if (cambios.page && cambios.page > 1) sp.set("page", String(cambios.page));
    const q = sp.toString();
    return q ? `${base}?${q}` : base;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Bandeja de casos"
        descripcion="Revisa las homologaciones que la IA dejó listas y emite el veredicto."
        icono={Briefcase}
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <BuscadorCasos />
            <FiltroFechas />
          </div>
        }
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-7">
          <div className="grid grid-cols-1 @xl:grid-cols-3 gap-5">
            <TarjetaStat icono={AlertCircle} acento="amber" titulo="Por revisar" valor={porEstado.en_revision} delayMs={0} />
            <TarjetaStat icono={Clock} acento="marca" titulo="Procesando" valor={porEstado.procesando} delayMs={60} />
            <TarjetaStat icono={Inbox} acento="slate" titulo="Casos totales" valor={total} delayMs={120} />
          </div>

          {/* Filtro por estado (pestañas con conteo) + exportar. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
              {ESTADOS_TAB.map((tab) => {
                const activo = (estadoFiltro ?? "") === tab.clave;
                const cantidad = tab.clave === "" ? total : porEstado[tab.clave];
                return (
                  <Link
                    key={tab.clave || "todos"}
                    href={hrefCon({ estado: tab.clave || null })}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      activo ? "bg-marca text-marca-fg" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    {tab.label}
                    <span
                      className={clsx(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full",
                        activo ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {cantidad}
                    </span>
                  </Link>
                );
              })}
            </div>

            <a
              href={hrefCon({}, "/casos/export")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </a>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500" style={{ animationDelay: "160ms" }}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50/80 dark:bg-slate-900/50">
                  <tr>
                    <Th>Solicitante</Th>
                    <Th>Carrera destino</Th>
                    <Th>Fecha</Th>
                    <Th>Estado</Th>
                    <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {casos.map((caso) => {
                    const ui = ESTADO_UI[caso.estado];
                    const dias = diasDesde(caso.creado_en);
                    const demorado = caso.estado === "en_revision" && dias >= SLA_DIAS;
                    return (
                      <tr key={caso.id} className="hover:bg-marca/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {caso.solicitante_nombre ?? "Invitado"}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{caso.institucion_origen_nombre}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-200">
                          {caso.pensum?.carrera ?? "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            {formatearFecha(caso.creado_en)}
                            {demorado && (
                              <span
                                title={`Lleva ${dias} días por revisar`}
                                className={clsx(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                                  dias >= 7
                                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30"
                                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
                                )}
                              >
                                <Clock className="w-3 h-3" />
                                {dias}d
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ui.clases}`}
                          >
                            <ui.Icono className="w-3.5 h-3.5" />
                            {ui.etiqueta}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-4">
                            <Link
                              href={`/casos/${caso.id}`}
                              className="inline-flex items-center gap-1 text-marca font-semibold hover:gap-1.5 transition-all"
                            >
                              {caso.estado === "en_revision" ? "Revisar" : "Ver detalle"}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                            <BotonEliminarCaso casoId={caso.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {casos.length === 0 && (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                    <Inbox className="w-7 h-7" />
                  </div>
                  <p className="mt-4 text-slate-500 dark:text-slate-400">
                    {termino || estadoFiltro
                      ? "Ningún caso coincide con los filtros."
                      : "No hay casos en este rango de fechas."}
                  </p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Página {pagina} de {totalPaginas} · {totalFiltrado} casos
                </span>
                <div className="flex items-center gap-2">
                  <Enlace href={hrefCon({ page: pagina - 1 })} activo={pagina > 1}>
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </Enlace>
                  <Enlace href={hrefCon({ page: pagina + 1 })} activo={pagina < totalPaginas}>
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </Enlace>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

// Botón de paginación: enlace si está disponible, o un span deshabilitado si no.
function Enlace({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  const clase = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border";
  if (!activo) {
    return (
      <span className={clsx(clase, "border-slate-200 dark:border-slate-800 text-slate-300 cursor-not-allowed")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={clsx(clase, "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")}>
      {children}
    </Link>
  );
}
