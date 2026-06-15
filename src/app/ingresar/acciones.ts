"use server";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";

// Estado que estas acciones devuelven al formulario: o no hay nada que mostrar (null), o un
// mensaje de error para pintar bajo los campos. El éxito no devuelve estado porque redirige.
export type EstadoAuth = { error: string } | null;

// A propósito los mensajes de error son genéricos: no decimos "ese correo no existe" ni "la
// clave está mal" por separado. Si distinguiéramos, un atacante podría averiguar qué correos
// están registrados probando de a uno (enumeración de usuarios).
export async function ingresar(
  _estadoPrevio: EstadoAuth,
  datos: FormData,
): Promise<EstadoAuth> {
  const correo = String(datos.get("email") ?? "").trim();
  const clave = String(datos.get("password") ?? "");

  if (!correo || !clave) {
    return { error: "Escribí tu correo y tu contraseña." };
  }

  const supabase = crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: clave,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  // signInWithPassword ya dejó la cookie de sesión vía el cliente de servidor; al redirigir,
  // la siguiente página ya reconoce al usuario.
  redirect("/casos");
}

export async function registrarse(
  _estadoPrevio: EstadoAuth,
  datos: FormData,
): Promise<EstadoAuth> {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const correo = String(datos.get("email") ?? "").trim();
  const clave = String(datos.get("password") ?? "");

  if (!nombre || !correo || !clave) {
    return { error: "Completá nombre, correo y contraseña." };
  }
  if (clave.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = crearClienteServidor();
  const { error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    // El nombre viaja como metadata del usuario. El trigger al_crear_usuario (migración 0001)
    // lo lee de raw_user_meta_data->>'nombre' para rellenar la tabla perfil al darse de alta.
    options: { data: { nombre } },
  });

  if (error) {
    return { error: "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo." };
  }

  // En local enable_confirmations está en false, así que el alta ya inicia sesión: entramos
  // directo. Cuando activemos confirmación por correo, acá habrá que mandar a una pantalla de
  // "revisá tu bandeja" en vez de a /casos.
  redirect("/casos");
}
