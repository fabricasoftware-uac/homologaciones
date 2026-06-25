"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { crearClienteNavegador } from "@/lib/supabase/navegador";

// Escucha en tiempo real los cambios de UN caso concreto (el del estudiante) y refresca la vista
// cuando el admin lo decide: así el estudiante ve pasar su solicitud a "Aprobada"/"No aprobada" sin
// recargar. Es el espejo, acotado a un solo caso, de EscuchaCasos (que usa el admin para la bandeja).
//
// Igual que en el admin, hay que fijar el token de la sesión en Realtime (setAuth) antes de
// suscribir; si no, la conexión va anónima y la RLS de `caso` no entrega ningún evento. Funciona con
// la sesión (anónima) del estudiante porque la RLS lo deja ver SU propio caso.
export function EscuchaCaso({ casoId }: { casoId: string }) {
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
        .channel(`caso-${casoId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "caso", filter: `id=eq.${casoId}` },
          () => router.refresh(),
        )
        .subscribe();
    })();

    return () => {
      activo = false;
      if (canal) supabase.removeChannel(canal);
    };
  }, [casoId, router]);

  return null;
}
