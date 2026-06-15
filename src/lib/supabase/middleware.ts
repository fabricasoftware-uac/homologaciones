import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se pueden ver SIN sesión. Todo lo demás (el grupo (app)) queda detrás del login.
const RUTAS_PUBLICAS = ["/ingresar"];

// Corre en cada request: renueva la sesión de Supabase y, de paso, hace de portero.
//   - Sin sesión en una ruta privada  -> al login.
//   - Con sesión parado en el login    -> adentro (la home ya redirige a su sección).
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
          // Guardamos las cookies renovadas en la request (para lo que siga en esta vuelta)
          // y en la response (para que viajen de vuelta al navegador).
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
  // es lo que valida y renueva la sesión. Mover o demorar esto provoca cierres intermitentes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some(
    (publica) => ruta === publica || ruta.startsWith(`${publica}/`),
  );

  if (!user && !esPublica) {
    return redirigir(request, "/ingresar", respuesta);
  }
  if (user && esPublica) {
    return redirigir(request, "/", respuesta);
  }

  return respuesta;
}

// Construye la redirección arrastrándole las cookies que getUser pudo haber renovado: como es
// una response nueva, si no las copiamos una sesión recién refrescada se perdería en el salto.
function redirigir(request: NextRequest, destino: string, respuesta: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = destino;

  const redireccion = NextResponse.redirect(url);
  respuesta.cookies
    .getAll()
    .forEach((cookie) => redireccion.cookies.set(cookie));
  return redireccion;
}
