import Link from "next/link";
import {
  IconInbox as Inbox,
  IconAlertCircle as AlertCircle,
  IconCircleCheck as CheckCircle2,
  IconTrendingUp as TrendingUp,
  IconChartBar as BarChart3,
  IconArrowRight as ArrowRight,
  IconSchool as School,
  IconBuilding as Building,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { EncabezadoPagina } from "@/components/encabezado";
import { TarjetaStat } from "@/components/tarjeta-stat";
import type { EstadoCaso } from "@/types";
import { GraficaEstados, GraficaBarras, GraficaTiempo } from "./graficas";
import { FiltroFechas } from "@/components/filtro-fechas";
import { rangoDesdeParams } from "@/lib/fechas";

// Reportes (admin): panorama de las homologaciones con gráficas interactivas, filtro por fecha y una
// lista de pendientes accionable. Calculado en el servidor a partir de los casos del rango elegido.

const ESTADOS_UI: { clave: EstadoCaso; nombre: string; color: string }[] = [
  { clave: "procesando", nombre: "Procesando", color: "#3b82f6" },
  { clave: "en_revision", nombre: "Por revisar", color: "#f59e0b" },
  { clave: "aprobado", nombre: "Aprobados", color: "#22c55e" },
  { clave: "rechazado", nombre: "Rechazados", color: "#ef4444" },
];

type CasoFila = {
  id: string;
  estado: EstadoCaso;
  creado_en: string;
  semestre_sugerido: number | null;
  solicitante_nombre: string | null;
  institucion_origen_nombre: string;
  pensum: { carrera: string } | null;
};

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function diaCorto(iso: string) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(iso));
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-5">{titulo}</h2>
      {children}
    </div>
  );
}

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: { periodo?: string; desde?: string; hasta?: string };
}) {
  const rango = rangoDesdeParams(searchParams);
  const cfg = await obtenerConfiguracion();
  const supabase = crearClienteServidor();

  let consulta = supabase
    .from("caso")
    .select(
      "id, estado, creado_en, semestre_sugerido, solicitante_nombre, institucion_origen_nombre, pensum:pensum_destino_id (carrera)",
    )
    .order("creado_en", { ascending: false });
  if (rango.desde) consulta = consulta.gte("creado_en", rango.desde);
  if (rango.hasta) consulta = consulta.lte("creado_en", rango.hasta);
  const { data } = await consulta;
  const casos = (data ?? []) as unknown as CasoFila[];

  const total = casos.length;
  const porEstado = { procesando: 0, en_revision: 0, aprobado: 0, rechazado: 0 } as Record<EstadoCaso, number>;
  const porCarrera = new Map<string, number>();
  const porInstitucion = new Map<string, number>();
  const porDia = new Map<string, number>();
  // Para la tasa de aprobación por carrera.
  const carreraStats = new Map<string, { aprob: number; decididos: number; total: number }>();
  let sumaSemestre = 0;
  let conSemestre = 0;

  for (const c of casos) {
    porEstado[c.estado] += 1;
    const carrera = c.pensum?.carrera ?? "Sin carrera";
    porCarrera.set(carrera, (porCarrera.get(carrera) ?? 0) + 1);
    porInstitucion.set(c.institucion_origen_nombre, (porInstitucion.get(c.institucion_origen_nombre) ?? 0) + 1);

    const d = new Date(c.creado_en);
    const claveDia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    porDia.set(claveDia, (porDia.get(claveDia) ?? 0) + 1);

    const cs = carreraStats.get(carrera) ?? { aprob: 0, decididos: 0, total: 0 };
    cs.total += 1;
    if (c.estado === "aprobado") {
      cs.aprob += 1;
      cs.decididos += 1;
    } else if (c.estado === "rechazado") {
      cs.decididos += 1;
    }
    carreraStats.set(carrera, cs);

    if (c.semestre_sugerido != null) {
      sumaSemestre += c.semestre_sugerido;
      conSemestre += 1;
    }
  }

  const decididos = porEstado.aprobado + porEstado.rechazado;
  const tasaAprobacion = decididos > 0 ? Math.round((porEstado.aprobado / decididos) * 100) : 0;
  const semestrePromedio = conSemestre > 0 ? (sumaSemestre / conSemestre).toFixed(1) : "—";

  const datosEstados = ESTADOS_UI.map((e) => ({ nombre: e.nombre, valor: porEstado[e.clave], color: e.color }));
  const datosCarreras = Array.from(porCarrera.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));
  const datosInstituciones = Array.from(porInstitucion.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));
  const serieTiempo = Array.from(porDia.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, cantidad]) => ({ fecha: diaCorto(`${clave}T00:00:00`), cantidad }));
  const tasaPorCarrera = Array.from(carreraStats.entries())
    .filter(([, s]) => s.decididos > 0)
    .map(([carrera, s]) => ({ carrera, tasa: Math.round((s.aprob / s.decididos) * 100), total: s.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const pendientes = casos.filter((c) => c.estado === "en_revision");

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina titulo="Reportes" descripcion="Panorama de las homologaciones." icono={BarChart3} accion={<FiltroFechas />} />

      <main className="p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-7">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-5">
            <TarjetaStat icono={Inbox} acento="slate" titulo="Casos totales" valor={total} delayMs={0} />
            <TarjetaStat icono={AlertCircle} acento="amber" titulo="Por revisar" valor={porEstado.en_revision} delayMs={60} />
            <TarjetaStat icono={CheckCircle2} acento="green" titulo="Aprobados" valor={porEstado.aprobado} delayMs={120} />
            <TarjetaStat icono={TrendingUp} acento="marca" titulo="Tasa de aprobación" valor={`${tasaAprobacion}%`} delayMs={180} />
          </div>

          <Panel titulo="Homologaciones en el tiempo">
            <GraficaTiempo datos={serieTiempo} color={cfg.colorPrimario} />
          </Panel>

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            <Panel titulo="Casos por estado">
              <GraficaEstados datos={datosEstados} />
            </Panel>
            <Panel titulo="Carreras más solicitadas">
              <GraficaBarras datos={datosCarreras} color={cfg.colorPrimario} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            <Panel titulo="Instituciones de origen más frecuentes">
              <GraficaBarras datos={datosInstituciones} color={cfg.colorAcento} />
            </Panel>
            <Panel titulo="Tasa de aprobación por carrera">
              {tasaPorCarrera.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Aún no hay casos decididos.</p>
              ) : (
                <div className="space-y-3.5">
                  {tasaPorCarrera.map((t) => (
                    <div key={t.carrera}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-slate-600 dark:text-slate-300 truncate pr-2">{t.carrera}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">{t.tasa}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${t.tasa}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Dato extra: a qué semestre quedan en promedio. */}
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-5">
            <TarjetaStat icono={School} acento="marca" titulo="Semestre promedio" valor={semestrePromedio} delayMs={0} />
            <TarjetaStat icono={Building} acento="slate" titulo="Instituciones distintas" valor={porInstitucion.size} delayMs={60} />
            <TarjetaStat icono={School} acento="slate" titulo="Carreras solicitadas" valor={porCarrera.size} delayMs={120} />
            <TarjetaStat icono={AlertCircle} acento="amber" titulo="Pendientes" valor={pendientes.length} delayMs={180} />
          </div>

          {/* Pendientes por revisar: accionables, llevan al estudio del caso. */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Pendientes por revisar ({pendientes.length})
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {pendientes.map((c) => (
                <Link
                  key={c.id}
                  href={`/casos/${c.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-marca/5 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.solicitante_nombre ?? "Invitado"}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {c.pensum?.carrera ?? "—"} · {formatearFecha(c.creado_en)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-marca shrink-0 group-hover:gap-1.5 transition-all">
                    Revisar <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))}
              {pendientes.length === 0 && (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No hay homologaciones pendientes en este periodo.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
