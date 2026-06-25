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
    return { error: "Escribe tu correo y tu contraseña." };
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
