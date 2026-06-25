"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";

// Creación de nuevos administradores desde el panel. Crear usuarios en Auth requiere la admin API
// (cliente de SERVICIO con la secret key). Como ese cliente se salta toda autorización, validamos a
// mano que QUIEN llama sea admin antes de hacer nada: la ruta ya está protegida por el middleware,
// pero un server action es un endpoint y conviene cerrarlo también aquí.

export type EstadoUsuario = { error: string } | { ok: true } | null;

async function quienLlamaEsAdmin(): Promise<boolean> {
  const sesion = crearClienteServidor();
  const {
    data: { user },
  } = await sesion.auth.getUser();
  if (!user) return false;
  const { data } = await sesion.from("perfil").select("rol").eq("id", user.id).single();
  return (data as { rol: string } | null)?.rol === "admin";
}

export async function crearAdmin(
  _previo: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  if (!(await quienLlamaEsAdmin())) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const correo = String(formData.get("email") ?? "").trim().toLowerCase();
  const clave = String(formData.get("password") ?? "");

  if (!nombre) return { error: "Escribe el nombre del administrador." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "El correo no es válido." };
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = crearClienteServicio();
  const { data, error } = await supabase.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true, // sin verificación por correo: puede ingresar de inmediato
    user_metadata: { nombre },
  });
  if (error || !data.user) {
    const yaExiste = error?.message?.toLowerCase().includes("already");
    return { error: yaExiste ? "Ya existe un usuario con ese correo." : "No pudimos crear el usuario." };
  }

  // El trigger creó su perfil con rol 'estudiante'; lo promovemos a admin.
  const { error: errorRol } = await supabase.from("perfil").update({ rol: "admin" }).eq("id", data.user.id);
  if (errorRol) {
    return { error: "Se creó el usuario, pero no pudimos asignarle el rol de administrador." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}
