import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Rol } from "@/types";

// Rutas que se pueden ver SIN sesión. El estudiante ya no se registra: entra como invitado y
// homologa libremente, así que su flujo (la home, el formulario y "Mis homologaciones") es público.
// El login es solo para el admin. Todo lo demás queda detrás de la sesión.
const RUTAS_PUBLICAS = [
  "/",
  "/ingresar",
  "/homologar",
  "/mis-homologaciones",
  "/privacidad",
  // Seguimiento por token: el invitado que perdió su sesión vuelve a su caso desde el enlace del
  // correo, sin necesidad de iniciar sesión.
  "/seguimiento",
];

// Rutas exclusivas del admin: la bandeja de casos, los planes académicos, los reportes y la
// configuración de marca. Un estudiante o invitado con sesión que intente entrar aquí por URL
// directa es devuelto a su flujo.
const RUTAS_ADMIN = ["/inicio", "/casos", "/carreras", "/reportes", "/configuracion", "/usuarios"];

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

  // Esta llamada DEBE ir aquí, sin código entre la creación del cliente y este getUser():
  // es lo que valida y renueva la sesión. Mover o demorar esto provoca cierres intermitentes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  // "/" coincide solo exacto: si usáramos startsWith, "/" volvería pública toda la app. El resto
  // coincide con la ruta y sus subrutas.
  const esPublica = RUTAS_PUBLICAS.some((publica) =>
    publica === "/" ? ruta === "/" : ruta === publica || ruta.startsWith(`${publica}/`),
  );

  if (!user && !esPublica) {
    return redirigir(request, "/ingresar", respuesta);
  }
  // Un usuario REAL (no invitado anónimo) parado en el login no tiene nada que hacer ahí -> adentro.
  // Al invitado anónimo SÍ lo dejamos entrar a /ingresar, por si quiere iniciar sesión como admin.
  if (user && !user.is_anonymous && ruta === "/ingresar") {
    return redirigir(request, "/", respuesta);
  }

  // Candado de rol. Solo consultamos el perfil cuando la ruta es de admin, para no pagar una
  // consulta extra en cada request. Aquí ya sabemos que hay sesión (si no la hubiera, el chequeo
  // de arriba ya habría mandado al login).
  const esRutaAdmin = RUTAS_ADMIN.some(
    (admin) => ruta === admin || ruta.startsWith(`${admin}/`),
  );
  if (user && esRutaAdmin) {
    const { data } = await supabase
      .from("perfil")
      .select("rol")
      .eq("id", user.id)
      .single();
    const rol = (data as { rol: Rol } | null)?.rol ?? "estudiante";
    if (rol !== "admin") {
      return redirigir(request, "/homologar", respuesta);
    }
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
