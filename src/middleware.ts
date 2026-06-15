import { type NextRequest } from "next/server";

import { actualizarSesion } from "@/lib/supabase/middleware";

// Next ejecuta este middleware antes de cada request que coincida con el `matcher` de abajo.
//
// Por ahora su único trabajo es mantener viva la sesión de Supabase. La protección de rutas
// (mandar al login si no hay sesión, y separar lo que ve el estudiante de lo que ve el admin)
// la sumaremos acá mismo más adelante, cuando ya exista la pantalla de login y los roles.
export async function middleware(request: NextRequest) {
  return await actualizarSesion(request);
}

export const config = {
  matcher: [
    // Aplica a todas las rutas EXCEPTO los archivos internos de Next y las imágenes: esos
    // no necesitan sesión y hacerlos pasar por acá solo agregaría trabajo inútil en cada carga.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
