"use server";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cierra la sesión y devuelve al usuario al login. signOut borra la cookie de sesión vía el
// cliente de servidor; a partir de ahí el middleware ya no lo deja volver a entrar sin loguearse.
export async function cerrarSesion() {
  const supabase = crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
