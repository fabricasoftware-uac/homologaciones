import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para el SERVIDOR (Server Components, Route Handlers y Server Actions).
//
// A diferencia del cliente de navegador, este lee y escribe la sesión del usuario en las
// cookies, para que el login se mantenga al moverse entre páginas. Usa la MISMA publishable
// key: así actúa "en nombre del usuario logueado" y respeta sus reglas RLS.
//
// Ojo (corrige el comentario viejo del scaffold): este NO es el cliente para saltarse RLS.
// El día que el admin necesite acceso total ignorando RLS, haremos un cliente aparte con la
// secret key en su propio archivo, para no mezclarlo con el flujo normal y exponerlo por error.
export function crearClienteServidor() {
  const almacenCookies = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesNuevas) {
          try {
            cookiesNuevas.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, options),
            );
          } catch {
            // Un Server Component solo puede LEER cookies, no escribirlas. Cuando ese es el
            // caso, este error es esperable y lo ignoramos: el middleware ya se encarga de
            // refrescar la sesión en cada request.
          }
        },
      },
    },
  );
}
