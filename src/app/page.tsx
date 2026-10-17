import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Rol } from "@/types";

// IrisLab es una plataforma institucional para uso interno de la universidad.
// La raíz (/) redirige al panel correspondiente si hay sesión activa, o al login (/ingresar).
export default async function Home() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
    const rol = (data as { rol: Rol } | null)?.rol;
    if (rol === "admin") {
      redirect("/inicio");
    }
    redirect("/casos");
  }

  redirect("/ingresar");
}
