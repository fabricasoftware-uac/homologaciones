"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import type { Rol } from "@/types";

// Creación y gestión del STAFF del panel (admin, asesor, verificador). Crear usuarios en Auth
// requiere la admin API (cliente de SERVICIO con la secret key). Como ese cliente se salta toda
// autorización, validamos a mano que QUIEN llama sea admin antes de hacer nada: la ruta ya está
// protegida por el middleware, pero un server action es un endpoint y conviene cerrarlo también aquí.

export type EstadoUsuario = { error: string } | { ok: true } | null;

// Roles asignables desde el panel (estudiante no se asigna: es el default de quien se registra).
const ROLES_STAFF: Rol[] = ["admin", "asesor", "verificador"];

const ETIQUETA: Record<string, string> = {
  admin: "administrador",
  asesor: "asesor",
  verificador: "verificador",
};

async function usuarioActualAdmin(): Promise<string | null> {
  const sesion = crearClienteServidor();
  const {
    data: { user },
  } = await sesion.auth.getUser();
  if (!user) return null;
  const { data } = await sesion.from("perfil").select("rol").eq("id", user.id).single();
  return (data as { rol: string } | null)?.rol === "admin" ? user.id : null;
}

export async function crearUsuarioStaff(
  _previo: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  if (!(await usuarioActualAdmin())) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const correo = String(formData.get("email") ?? "").trim().toLowerCase();
  const clave = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "") as Rol;

  if (!nombre) return { error: "Escribe el nombre de la persona." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "El correo no es válido." };
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!ROLES_STAFF.includes(rol)) return { error: "Elige un rol válido." };

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

  // El trigger creó su perfil con rol 'estudiante'; le asignamos el rol elegido.
  const { error: errorRol } = await supabase.from("perfil").update({ rol }).eq("id", data.user.id);
  if (errorRol) {
    return { error: `Se creó el usuario, pero no pudimos asignarle el rol de ${ETIQUETA[rol]}.` };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

// Edita un miembro del staff: nombre y, si se indica, una contraseña nueva (vía admin API).
export async function editarUsuario(formData: FormData): Promise<{ error: string } | void> {
  if (!(await usuarioActualAdmin())) return { error: "No autorizado." };

  const usuarioId = String(formData.get("usuarioId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const clave = String(formData.get("password") ?? "");
  if (!usuarioId) return { error: "Usuario no válido." };
  if (!nombre) return { error: "Escribe el nombre de la persona." };
  if (clave && clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = crearClienteServicio();
  const { error } = await supabase.from("perfil").update({ nombre }).eq("id", usuarioId);
  if (error) return { error: "No pudimos guardar los cambios." };

  if (clave) {
    const { error: errorClave } = await supabase.auth.admin.updateUserById(usuarioId, {
      password: clave,
    });
    if (errorClave) return { error: "Se guardó el nombre, pero no pudimos cambiar la contraseña." };
  }

  revalidatePath("/usuarios");
}

// Elimina un miembro del staff (su cuenta de Auth; el perfil cae en cascada y sus referencias quedan
// saneadas por las FKs: notificaciones dirigidas se borran, y los casos que decidió o tenía
// asignados quedan sin esa referencia, no se pierden). No permite eliminarse a uno mismo.
export async function eliminarUsuario(formData: FormData): Promise<{ error: string } | void> {
  const adminId = await usuarioActualAdmin();
  if (!adminId) return { error: "No autorizado." };

  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return { error: "Usuario no válido." };
  if (usuarioId === adminId) return { error: "No puedes eliminar tu propia cuenta." };

  const supabase = crearClienteServicio();
  const { error } = await supabase.auth.admin.deleteUser(usuarioId);
  if (error) return { error: "No pudimos eliminar el usuario." };

  revalidatePath("/usuarios");
}

// Cambia el rol de un miembro del staff. No permite cambiarse el rol a uno mismo (un admin que se
// degrada por accidente dejaría el panel sin administrador a la mano).
export async function cambiarRol(formData: FormData): Promise<{ error: string } | void> {
  const adminId = await usuarioActualAdmin();
  if (!adminId) return { error: "No autorizado." };

  const usuarioId = String(formData.get("usuarioId") ?? "");
  const rol = String(formData.get("rol") ?? "") as Rol;
  if (!usuarioId) return { error: "Usuario no válido." };
  if (!ROLES_STAFF.includes(rol)) return { error: "Elige un rol válido." };
  if (usuarioId === adminId) return { error: "No puedes cambiar tu propio rol." };

  const supabase = crearClienteServicio();
  const { error } = await supabase.from("perfil").update({ rol }).eq("id", usuarioId);
  if (error) return { error: "No pudimos cambiar el rol." };

  revalidatePath("/usuarios");
}
