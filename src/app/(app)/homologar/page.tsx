import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Rol } from "@/types";

export default async function PaginaHomologar() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ingresar");
  }

  const { data: perfilData } = await supabase
    .from("perfil")
    .select("rol")
    .eq("id", user.id)
    .single();

  const rol: Rol = (perfilData as { rol: Rol } | null)?.rol ?? "estudiante";
  if (rol === "admin" || rol === "asesor") {
    redirect("/casos/nuevo");
  }

  redirect("/casos");
}
