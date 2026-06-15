import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase en cada request antes de que llegue a la página.
//
// El token de acceso del usuario caduca cada cierto rato; si nadie lo renueva, el servidor
// deja de reconocer al usuario y lo termina echando. Acá creamos un cliente atado a las
// cookies de ESTA request, llamamos a getUser() (que renueva el token si hace falta) y
// devolvemos la respuesta con las cookies ya actualizadas.
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          // Guardamos las cookies renovadas en dos lados: en la request (para lo que siga
          // procesándose en esta misma vuelta) y en la response (para que viajen de vuelta
          // al navegador del usuario).
          cookiesNuevas.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesNuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Esta llamada DEBE ir acá, sin código entre la creación del cliente y este getUser():
  // es lo que valida y renueva la sesión. Mover o demorar esto provoca cierres de sesión
  // intermitentes difíciles de depurar.
  await supabase.auth.getUser();

  return respuesta;
}
