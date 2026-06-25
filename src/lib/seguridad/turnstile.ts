// Verificación del captcha de Cloudflare Turnstile, del lado del servidor.
//
// El formulario público manda un token (cf-turnstile-response); aquí lo validamos contra Cloudflare
// con el secret. Si la clave no está configurada, OMITIMOS la verificación (captcha deshabilitado)
// para no romper el formulario por falta de config; pero si está configurada y el token es inválido
// o falta, bloqueamos.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verificarTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY no configurada; se omite la verificación del captcha.",
    );
    return true; // captcha deshabilitado
  }
  if (!token) return false;

  try {
    const cuerpo = new URLSearchParams();
    cuerpo.set("secret", secret);
    cuerpo.set("response", token);

    const respuesta = await fetch(VERIFY_URL, { method: "POST", body: cuerpo });
    const datos = (await respuesta.json()) as { success?: boolean };
    return datos.success === true;
  } catch (error) {
    console.error("[turnstile] Error verificando el captcha:", error);
    return false;
  }
}
