"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { crearClienteNavegador } from "@/lib/supabase/navegador";

// Escucha en tiempo real los cambios en la tabla `caso` (vía Supabase Realtime) para el ADMIN:
//   - cuando entra una homologación NUEVA (INSERT) -> le avisa con una notificación.
//   - ante cualquier cambio -> refresca los datos del servidor (router.refresh), así la bandeja se
//     actualiza sola sin recargar la página.
//
// CLAVE: antes de suscribir hay que fijar el token de sesión en la conexión de Realtime
// (realtime.setAuth). Si no, la conexión viaja como anónima y la RLS de `caso` no le deja ver
// ningún caso -> no llega ningún evento. Con el token del admin, la RLS lo deja ver todos y los
// eventos sí llegan.
export function EscuchaCasos() {
  const router = useRouter();

  useEffect(() => {
    const supabase = crearClienteNavegador();
    let canal: RealtimeChannel | null = null;
    let activo = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      canal = supabase
        .channel("casos-admin")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "caso" },
          () => {
            // El aviso (toast + campana) lo dispara la notificación; aquí solo mantenemos la bandeja
            // al día ante cualquier cambio en los casos (sin volver a notificar).
            router.refresh();
          },
        )
        .subscribe();
    })();

    return () => {
      activo = false;
      if (canal) supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
