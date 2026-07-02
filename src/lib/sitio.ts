// URL pública base del sitio, para armar enlaces ABSOLUTOS (el QR de verificación del acta y los
// enlaces de seguimiento que viajan en los correos). Se resuelve en cascada:
//   1. NEXT_PUBLIC_SITE_URL           — tu dominio propio; lo ideal en producción (p. ej. un dominio
//                                        institucional). Configúralo en Vercel para fijar la URL.
//   2. VERCEL_PROJECT_PRODUCTION_URL  — el dominio ESTABLE de producción del proyecto en Vercel
//                                        (no cambia entre deploys). Lo inyecta Vercel automáticamente.
//   3. VERCEL_URL                     — el dominio del deploy actual (útil en previews).
//   4. http://localhost:3000          — desarrollo local.
//
// Antes, los enlaces caían directo a "http://localhost:3000" en producción cuando NEXT_PUBLIC_SITE_URL
// no estaba configurada: por eso el PDF del acta salía con un QR apuntando a localhost. Con esta
// cascada, aunque olvides la variable, en Vercel resuelve solo al dominio real del proyecto.
//
// Nota: las variables de Vercel vienen SIN esquema (solo el host), así que les anteponemos https://.
// Solo debe llamarse desde código de SERVIDOR: VERCEL_* no llevan el prefijo NEXT_PUBLIC_ y no existen
// en el navegador.
export function sitioUrl(): string {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicita) return explicita.replace(/\/$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) return `https://${vercelProd}`.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");

  return "http://localhost:3000";
}
