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
  let perfil: Perfil = { nombre: "Invitado", rol: "estudiante" };
  if (user) {
    const { data } = await supabase
      .from("perfil")
      .select("nombre, rol")
      .eq("id", user.id)
      .single();
    perfil = (data as Perfil | null) ?? perfil;
  }

  const marca = await obtenerConfiguracion();

  return (
    <>
      {/* El marco (sidebar colapsable + header móvil) es cliente: necesita estado para ocultar/mostrar
          el menú. El layout resuelve el perfil y la marca, y se los entrega. */}
      <AppShell perfil={perfil} marca={marca}>{children}</AppShell>
      {/* Solo el admin: avisos en vivo + auto-actualización de la bandeja. */}
      {perfil.rol === "admin" && <EscuchaCasos />}
    </>
  );
}
