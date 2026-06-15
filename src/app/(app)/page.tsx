import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Rol } from "@/types";

// La home no tiene pantalla propia: manda a cada quien a su sección según el rol. El estudiante
// arranca en su formulario de homologación; el admin, en la bandeja de casos.
export default async function Home() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/ingresar");
  }

  const { data } = await supabase
    .from("perfil")
    .select("rol")
    .eq("id", user.id)
    .single();
  const rol = (data as { rol: Rol } | null)?.rol ?? "estudiante";

  redirect(rol === "admin" ? "/casos" : "/homologar");
}
