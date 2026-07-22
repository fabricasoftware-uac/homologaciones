import { crearClienteServidor } from "@/lib/supabase/servidor";
import { AppShell } from "@/components/app-shell";
import { EscuchaCasos } from "@/components/escucha-casos";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import type { Perfil } from "@/types";

// Marco visual de la app. Leemos el perfil una sola vez y se lo pasamos al sidebar; las páginas
// hijas no tienen que volver a pedirlo.
//
// Aquí entran tanto el invitado (sin sesión o con sesión anónima) en su flujo público como el admin
// en su panel. El candado por rol de las rutas de admin lo aplica el middleware; este layout solo
// arma el marco con el perfil que corresponda.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión = invitado que todavía no envió nada. No lo expulsamos: le mostramos su flujo con un
  // perfil neutro. Si hay sesión, leemos su perfil real (el del invitado anónimo dice "Invitado").
  //
  // is_anonymous viene de auth.users, no de la tabla perfil: distingue al INVITADO (sesión
  // desechable del flujo público) de una CUENTA REGISTRADA. Sin sesión tratamos el perfil como
  // anónimo; una cuenta real siempre debe poder cerrar sesión, sea cual sea su rol.
  let perfil: Perfil = { nombre: "Invitado", rol: "estudiante", esAnonimo: true };
  if (user) {
    const { data } = await supabase
      .from("perfil")
      .select("nombre, rol")
      .eq("id", user.id)
      .single();
    const fila = data as Omit<Perfil, "esAnonimo"> | null;
    perfil = { ...(fila ?? perfil), esAnonimo: user.is_anonymous ?? false };
  }

  const marca = await obtenerConfiguracion();

  return (
    <>
      {/* El marco (sidebar colapsable + header móvil) es cliente: necesita estado para ocultar/mostrar
          el menú. El layout resuelve el perfil y la marca, y se los entrega. */}
      <AppShell perfil={perfil} marca={marca}>{children}</AppShell>
      {/* Staff con bandeja: avisos en vivo + auto-actualización (la RLS filtra lo que cada rol ve). */}
      {(perfil.rol === "admin" || perfil.rol === "asesor" || perfil.rol === "verificador") && (
        <EscuchaCasos />
      )}
    </>
  );
}
