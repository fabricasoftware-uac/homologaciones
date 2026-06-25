import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { Landing } from "@/components/landing";
import type { Rol } from "@/types";

// Home público (raíz). Vive FUERA del grupo (app), así que no lleva el sidebar: es la landing de
// marketing para el estudiante. El admin no la ve —lo mandamos directo a su panel—. El invitado (con
// o sin sesión anónima) ve la landing y entra al flujo desde ahí.
export default async function Home() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
    const rol = (data as { rol: Rol } | null)?.rol ?? "estudiante";
    if (rol === "admin") {
      redirect("/inicio");
    }
  }

  // Cantidad de carreras activas, para el contador animado del hero.
  const { count } = await supabase
    .from("pensum")
    .select("id", { count: "exact", head: true })
    .eq("activo", true);

  const marca = await obtenerConfiguracion();
  return <Landing marca={marca} tieneSesion={!!user} carreras={count ?? 0} />;
}
