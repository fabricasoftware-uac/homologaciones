"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBell as Bell,
  IconBellRinging as BellRinging,
  IconInbox as Inbox,
  IconUserCheck as UserCheck,
  IconCircleCheck as CircleCheck,
  IconChecks as Checks,
  IconTrash as Trash,
  IconX as X,
} from "@tabler/icons-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { sileo } from "sileo";

import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

// Campana de notificaciones del staff. Al abrirla se desliza un panel lateral con la bandeja:
// las NUEVAS arriba (acento por tipo, punto vivo), las anteriores debajo, y cada una se puede
// borrar (la X aparece al pasar el mouse) o vaciar toda la bandeja con confirmación en línea.
// En tiempo real, cada notificación nueva entra al panel, suena una campanita discreta y dispara
// el toast de sileo (una sola entidad).

type Notif = {
  id: string;
  tipo: string | null;
  titulo: string;
  cuerpo: string | null;
  caso_id: string | null;
  leida: boolean;
  creado_en: string;
};

function tiempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// Identidad visual por tipo de evento: el ícono cuenta la historia de un vistazo.
const TIPOS: Record<string, { Icono: typeof Bell; chip: string; acento: string }> = {
  homologacion_nueva: {
    Icono: Inbox,
    chip: "text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/15",
    acento: "bg-sky-400",
  },
  caso_asignado: {
    Icono: UserCheck,
    chip: "text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/15",
    acento: "bg-violet-400",
  },
  caso_aprobado: {
    Icono: CircleCheck,
    chip: "text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15",
    acento: "bg-emerald-400",
  },
};
const TIPO_DEFAULT = {
  Icono: Bell,
  chip: "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
  acento: "bg-slate-400",
};

// Campanita de dos tonos sintetizada con Web Audio (0 assets): sube de La5 a Mi6 con una caída
// suave. Si el navegador aún bloquea el audio (sin interacción previa), falla en silencio — el
// aviso visual basta.
let audioCtx: AudioContext | null = null;
function sonarCampanita() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    for (const [frecuencia, inicio] of [
      [880, 0],
      [1318.5, 0.09],
    ] as const) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = frecuencia;
      gain.gain.setValueAtTime(0, t + inicio);
      gain.gain.linearRampToValueAtTime(0.06, t + inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + inicio + 0.55);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + inicio);
      osc.stop(t + inicio + 0.6);
    }
  } catch {
    // Sin audio disponible: no es crítico.
  }
}

export function Campana() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const timeoutVaciar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noLeidas = notifs.filter((n) => !n.leida).length;

  useEffect(() => {
    const supabase = crearClienteNavegador();
    let canal: RealtimeChannel | null = null;
    let activo = true;

    (async () => {
      const { data } = await supabase
        .from("notificacion")
        .select("id, tipo, titulo, cuerpo, caso_id, leida, creado_en")
        .order("creado_en", { ascending: false })
        .limit(30);
      if (activo && data) setNotifs(data as Notif[]);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);

      canal = supabase
        .channel("campana-staff")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notificacion" },
          (payload) => {
            const n = payload.new as Notif;
            setNotifs((prev) => [n, ...prev].slice(0, 30));
            sonarCampanita();
            // Una sola entidad: la notificación también dispara el toast de sileo (con el color y la
            // posición que la institución configuró). Si tiene caso, el toast es INTERACTIVO: un
            // botón "Ver" lleva directo al estudio del caso.
            sileo.info({
              title: n.titulo,
              description: n.cuerpo ?? undefined,
              ...(n.caso_id
                ? { button: { title: "Ver", onClick: () => router.push(`/casos/${n.caso_id}`) } }
                : {}),
            });
          },
        )
        .subscribe();
    })();

    return () => {
      activo = false;
      if (canal) supabase.removeChannel(canal);
    };
  }, []);

  async function marcarLeida(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    await crearClienteNavegador().from("notificacion").update({ leida: true }).eq("id", id);
  }

  async function abrir(n: Notif) {
    setAbierto(false);
    await marcarLeida(n.id);
    if (n.caso_id) router.push(`/casos/${n.caso_id}`);
  }

  async function marcarTodas() {
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
    await crearClienteNavegador().from("notificacion").update({ leida: true }).eq("leida", false);
  }

  // Borrado individual: optimista (la tarjeta sale animada al instante) y best-effort en la BD.
  async function borrar(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await crearClienteNavegador().from("notificacion").delete().eq("id", id);
  }

  // Vaciar la bandeja con confirmación EN LÍNEA: el primer clic arma el botón (se pone rojo y
  // pregunta), el segundo ejecuta; si no confirmas en 3s, se desarma solo. Sin diálogos.
  async function vaciar() {
    if (!confirmarVaciar) {
      setConfirmarVaciar(true);
      if (timeoutVaciar.current) clearTimeout(timeoutVaciar.current);
      timeoutVaciar.current = setTimeout(() => setConfirmarVaciar(false), 3000);
      return;
    }
    if (timeoutVaciar.current) clearTimeout(timeoutVaciar.current);
    setConfirmarVaciar(false);
    setNotifs([]);
    await crearClienteNavegador()
      .from("notificacion")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const nuevas = notifs.filter((n) => !n.leida);
  const previas = notifs.filter((n) => n.leida);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {noLeidas > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
              >
                {noLeidas > 9 ? "9+" : noLeidas}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-80 max-w-[88vw] p-0 gap-0 flex flex-col bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
      >
        {/* Encabezado con las acciones de la bandeja. */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-2 shrink-0">
          <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Notificaciones
          </SheetTitle>
          {noLeidas > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              {noLeidas} nueva{noLeidas === 1 ? "" : "s"}
            </span>
          )}
          <span className="flex-1" />
          {noLeidas > 0 && (
            <button
              type="button"
              onClick={marcarTodas}
              title="Marcar todas como leídas"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-500/10 transition-colors"
            >
              <Checks className="w-[18px] h-[18px]" />
            </button>
          )}
          {notifs.length > 0 && (
            <button
              type="button"
              onClick={vaciar}
              title={confirmarVaciar ? "Confirmar: borrar todas" : "Vaciar la bandeja"}
              className={clsx(
                "flex items-center gap-1 rounded-lg transition-all",
                confirmarVaciar
                  ? "px-2.5 py-1.5 text-[11px] font-bold bg-red-500 text-white hover:bg-red-600"
                  : "p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-500/10",
              )}
            >
              <Trash className="w-[18px] h-[18px]" />
              {confirmarVaciar && "¿Vaciar?"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
          {[
            { clave: "nuevas", titulo: "Nuevas", lista: nuevas },
            { clave: "previas", titulo: "Anteriores", lista: previas },
          ].map(
            ({ clave, titulo, lista }) =>
              lista.length > 0 && (
                <div key={clave} className="mb-4">
                  <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {titulo}
                  </p>
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {lista.map((n) => {
                        const { Icono, chip, acento } = TIPOS[n.tipo ?? ""] ?? TIPO_DEFAULT;
                        return (
                          <motion.div
                            key={n.id}
                            layout
                            initial={{ opacity: 0, x: -28, scale: 0.96 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 48, height: 0, marginBottom: 0, overflow: "hidden" }}
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className="relative group"
                          >
                            <button
                              type="button"
                              onClick={() => abrir(n)}
                              className={clsx(
                                "relative w-full text-left rounded-2xl p-3.5 pl-4 flex gap-3 border overflow-hidden transition-shadow",
                                n.leida
                                  ? "bg-white/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 hover:shadow-sm"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md",
                              )}
                            >
                              {/* Barra de acento por tipo: solo mientras está sin leer. */}
                              {!n.leida && (
                                <span
                                  className={clsx("absolute left-0 top-0 bottom-0 w-1", acento)}
                                />
                              )}
                              <div
                                className={clsx(
                                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                  chip,
                                  n.leida && "opacity-60",
                                )}
                              >
                                <Icono className="w-[18px] h-[18px]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  <p
                                    className={clsx(
                                      "text-sm flex-1 leading-snug",
                                      n.leida
                                        ? "font-medium text-slate-500 dark:text-slate-400"
                                        : "font-semibold text-slate-900 dark:text-slate-100",
                                    )}
                                  >
                                    {n.titulo}
                                  </p>
                                  {!n.leida && (
                                    <span className={clsx("mt-1 w-2 h-2 rounded-full shrink-0", acento)} />
                                  )}
                                </div>
                                {n.cuerpo && (
                                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                    {n.cuerpo}
                                  </p>
                                )}
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {tiempoRelativo(n.creado_en)}
                                  </span>
                                  {n.caso_id && (
                                    <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full", chip)}>
                                      Ver caso
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            {/* Borrar esta notificación: aparece al pasar el mouse (o con teclado). */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void borrar(n.id);
                              }}
                              title="Borrar notificación"
                              aria-label={`Borrar: ${n.titulo}`}
                              className="absolute top-2 right-2 p-1 rounded-md text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              ),
          )}

          {notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 dark:text-slate-500">
              <div className="relative mb-4">
                <span className="absolute inset-0 rounded-full bg-sky-400/20 animate-ping" />
                <div className="relative w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-500 dark:text-sky-300 flex items-center justify-center">
                  <BellRinging className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-medium">Todo al día</p>
              <p className="text-xs mt-0.5">Cuando llegue un caso, sonará la campana.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
