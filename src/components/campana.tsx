"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell as Bell } from "@tabler/icons-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import clsx from "clsx";
import { sileo } from "sileo";

import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

// Campana de notificaciones del admin. Al abrirla se desliza un PANEL LATERAL (tipo centro de
// notificaciones de iPhone) sobre el sidebar, con tarjetas frosted. En tiempo real, cada
// notificación nueva entra al panel Y dispara el toast de sileo (una sola entidad).

type Notif = {
  id: string;
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

// Tomamos el color de las notificaciones de sileo (--sileo-state-info, configurable desde el panel) y
// replicamos su estética: ícono y título en ese color, sobre un fondo tenue del mismo color.
const TINT = "var(--sileo-state-info)";
const TINT_BG = "color-mix(in oklab, var(--sileo-state-info) 16%, transparent)";

export function Campana() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const noLeidas = notifs.filter((n) => !n.leida).length;

  useEffect(() => {
    const supabase = crearClienteNavegador();
    let canal: RealtimeChannel | null = null;
    let activo = true;

    (async () => {
      const { data } = await supabase
        .from("notificacion")
        .select("id, titulo, cuerpo, caso_id, leida, creado_en")
        .order("creado_en", { ascending: false })
        .limit(30);
      if (activo && data) setNotifs(data as Notif[]);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);

      canal = supabase
        .channel("campana-admin")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notificacion" },
          (payload) => {
            const n = payload.new as Notif;
            setNotifs((prev) => [n, ...prev].slice(0, 30));
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

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
          {noLeidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 max-w-[88vw] p-0 gap-0 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Notificaciones</SheetTitle>
          {noLeidas > 0 && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: TINT_BG, color: TINT }}
            >
              {noLeidas}
            </span>
          )}
        </div>
        {noLeidas > 0 && (
          <div className="px-5 pb-2">
            <button onClick={marcarTodas} className="text-xs font-medium hover:underline" style={{ color: TINT }}>
              Marcar todas como leídas
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-1 space-y-2">
          {notifs.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => abrir(n)}
              className={clsx(
                "w-full text-left rounded-2xl p-3.5 flex gap-3 border transition-all",
                n.leida
                  ? "bg-white dark:bg-slate-900 border-slate-200/70 hover:shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md",
              )}
            >
              {/* Ícono circular en el color de la notificación, como el badge de sileo. */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: TINT_BG, color: TINT }}
              >
                <Bell className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* Título en el color de la notificación, como sileo. */}
                  <p className="text-sm font-semibold flex-1 truncate" style={{ color: TINT }}>
                    {n.titulo}
                  </p>
                  {!n.leida && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TINT }} />
                  )}
                </div>
                {n.cuerpo && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.cuerpo}</p>}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{tiempoRelativo(n.creado_en)}</span>
                  {n.caso_id && (
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: TINT_BG, color: TINT }}
                    >
                      Ver caso
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 dark:text-slate-500">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: TINT_BG, color: TINT }}
              >
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm">No tienes notificaciones.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
