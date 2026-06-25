import Link from "next/link";
import {
  IconLayoutDashboard as LayoutDashboard,
  IconAlertCircle as AlertCircle,
  IconClock as Clock,
  IconTrendingUp as TrendingUp,
  IconHourglass as Hourglass,
  IconArrowRight as ArrowRight,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  IconBriefcase as Briefcase,
  IconBook as BookOpen,
  IconChartBar as BarChart3,
  IconSettings as Settings,
  type Icon as LucideIcon,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import { TarjetaStat } from "@/components/tarjeta-stat";

// Panel de inicio del admin: un vistazo accionable del estado de las homologaciones (en vez de caer
// directo en la tabla cruda de /casos). Reúne los indicadores clave, la cola de pendientes más
// antiguos, los últimos casos decididos y accesos rápidos a las secciones.

const SLA_DIAS = 3;

type PendienteFila = {
  id: string;
  solicitante_nombre: string | null;
  institucion_origen_nombre: string;
  creado_en: string;
  pensum: { carrera: string } | null;
};

type DecididoFila = {
  id: string;
  solicitante_nombre: string | null;
  estado: "aprobado" | "rechazado";
  decidido_en: string | null;
  pensum: { carrera: string } | null;
};

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(iso));
}

const ACCESOS: { href: string; icono: LucideIcon; titulo: string; descripcion: string }[] = [
  { href: "/casos", icono: Briefcase, titulo: "Casos de estudio", descripcion: "Revisa y emite veredictos" },
  { href: "/carreras", icono: BookOpen, titulo: "Planes académicos", descripcion: "Gestiona los pensums" },
  { href: "/reportes", icono: BarChart3, titulo: "Reportes", descripcion: "Analítica y tendencias" },
  { href: "/configuracion", icono: Settings, titulo: "Configuración", descripcion: "Marca y notificaciones" },
];

export default async function PaginaInicio() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfilData } = await supabase
    .from("perfil")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .single();
  const nombre = (perfilData as { nombre: string } | null)?.nombre?.split(/\s+/)[0] ?? "";

  const cuenta = (estado: string) =>
    supabase.from("caso").select("id", { count: "exact", head: true }).eq("estado", estado);

  const [revisar, procesando, aprob, rech, pendientesRes, decididosRes, tiemposRes] =
    await Promise.all([
      cuenta("en_revision"),
      cuenta("procesando"),
      cuenta("aprobado"),
      cuenta("rechazado"),
      supabase
        .from("caso")
        .select("id, solicitante_nombre, institucion_origen_nombre, creado_en, pensum:pensum_destino_id (carrera)")
        .eq("estado", "en_revision")
        .order("creado_en", { ascending: true })
        .limit(5),
      supabase
        .from("caso")
        .select("id, solicitante_nombre, estado, decidido_en, pensum:pensum_destino_id (carrera)")
        .in("estado", ["aprobado", "rechazado"])
        .order("decidido_en", { ascending: false, nullsFirst: false })
        .limit(5),
      supabase
        .from("caso")
        .select("creado_en, decidido_en")
        .not("decidido_en", "is", null)
        .order("decidido_en", { ascending: false })
        .limit(100),
    ]);

  const porRevisar = revisar.count ?? 0;
  const enProceso = procesando.count ?? 0;
  const aprobados = aprob.count ?? 0;
  const rechazados = rech.count ?? 0;
  const decididos = aprobados + rechazados;
  const tasa = decididos > 0 ? Math.round((aprobados / decididos) * 100) : 0;

  // Tiempo promedio de respuesta: media de (decidido_en - creado_en) sobre los casos ya decididos.
  const tiempos = (tiemposRes.data ?? []) as { creado_en: string; decidido_en: string | null }[];
  const horas = tiempos
    .filter((t) => t.decidido_en)
    .map((t) => (new Date(t.decidido_en!).getTime() - new Date(t.creado_en).getTime()) / 3_600_000)
    .filter((h) => h >= 0);
  const promHoras = horas.length > 0 ? horas.reduce((s, h) => s + h, 0) / horas.length : null;
  const tiempoTexto =
    promHoras == null ? "—" : promHoras < 24 ? `${Math.round(promHoras)} h` : `${(promHoras / 24).toFixed(1)} d`;

  const pendientes = (pendientesRes.data ?? []) as unknown as PendienteFila[];
  const recientes = (decididosRes.data ?? []) as unknown as DecididoFila[];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo={nombre ? `Hola, ${nombre}` : "Inicio"}
        descripcion="Un vistazo al estado de las homologaciones."
        icono={LayoutDashboard}
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-7">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-5">
            <TarjetaStat icono={AlertCircle} acento="amber" titulo="Por revisar" valor={porRevisar} delayMs={0} />
            <TarjetaStat icono={Clock} acento="marca" titulo="Procesando" valor={enProceso} delayMs={60} />
            <TarjetaStat icono={TrendingUp} acento="green" titulo="Tasa de aprobación" valor={`${tasa}%`} delayMs={120} />
            <TarjetaStat icono={Hourglass} acento="slate" titulo="Tiempo de respuesta" valor={tiempoTexto} delayMs={180} />
          </div>

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            {/* Cola de pendientes: los más antiguos primero (los que más urge revisar). */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-slate-800 dark:text-slate-200">Por revisar primero</h2>
                <Link href="/casos?estado=en_revision" className="text-sm font-semibold text-marca hover:underline">
                  Ver todos
                </Link>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendientes.map((c) => {
                  const dias = diasDesde(c.creado_en);
                  const demorado = dias >= SLA_DIAS;
                  return (
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
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{c.pensum?.carrera ?? "—"}</p>
                      </div>
                      <span
                        className={
                          demorado
                            ? "text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shrink-0"
                            : "text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0"
                        }
                      >
                        {dias === 0 ? "hoy" : `${dias}d`}
                      </span>
                    </Link>
                  );
                })}
                {pendientes.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No hay casos por revisar. Todo al día.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Últimos casos decididos. */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-slate-800 dark:text-slate-200">Decididos recientemente</h2>
                <Link href="/casos" className="text-sm font-semibold text-marca hover:underline">
                  Ver bandeja
                </Link>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recientes.map((c) => {
                  const aprobado = c.estado === "aprobado";
                  return (
                    <Link
                      key={c.id}
                      href={`/casos/${c.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-marca/5 transition-colors"
                    >
                      <div
                        className={
                          aprobado
                            ? "w-9 h-9 rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0"
                            : "w-9 h-9 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"
                        }
                      >
                        {aprobado ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.solicitante_nombre ?? "Invitado"}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{c.pensum?.carrera ?? "—"}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">
                        {c.decidido_en ? fechaCorta(c.decidido_en) : ""}
                      </span>
                    </Link>
                  );
                })}
                {recientes.length === 0 && (
                  <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Aún no hay casos decididos.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Accesos rápidos. */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Accesos rápidos</h2>
            <div className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-4 gap-4">
              {ACCESOS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:border-marca/40 hover:shadow transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-marca/10 text-marca flex items-center justify-center">
                    <a.icono className="w-5 h-5" />
                  </div>
                  <p className="mt-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {a.titulo}
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-marca group-hover:translate-x-0.5 transition-all" />
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{a.descripcion}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
