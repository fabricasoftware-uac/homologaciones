import { ErrorIANoDisponible } from "@/lib/groq/cliente";

export { ErrorIANoDisponible };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MAX_REINTENTOS_429 = 2;
const TOPE_ESPERA_MS = 2500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function esperaTrasRateLimit(respuesta: Response, detalle: string): number {
  const header = respuesta.headers.get("retry-after");
  if (header && Number.isFinite(Number(header))) return Math.ceil(Number(header) * 1000);
  const m = detalle.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (m && Number.isFinite(Number(m[1]))) {
    return m[2].toLowerCase() === "s" ? Math.ceil(Number(m[1]) * 1000) : Math.ceil(Number(m[1]));
  }
  return 1000;
}

const MODELOS: string[] = [
  "deepseek/deepseek-v4-flash",
];

export const MODELOS_LIGEROS: string[] = [
  "openai/gpt-4.1-nano",
];

export type MensajeGroq = { role: "system" | "user" | "assistant"; content: string };

export type OpcionesOpenRouter = {
  modelos?: string[];
  temperatura?: number;
  json?: boolean;
  maxTokens?: number;
};

type IntentoResultado =
  | { ok: true; contenido: string }
  | { ok: false; reintentar: boolean; motivo: string; esperaMs?: number };

async function intentarModelo(
  apiKey: string,
  modelo: string,
  mensajes: MensajeGroq[],
  opciones: OpcionesOpenRouter,
): Promise<IntentoResultado> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL;
    }
    headers["X-Title"] = "Homologaciones";

    const respuesta = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelo,
        temperature: opciones.temperatura ?? 0,
        ...(opciones.json ? { response_format: { type: "json_object" } } : {}),
        ...(opciones.maxTokens ? { max_tokens: opciones.maxTokens } : {}),
        messages: mensajes,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      const reintentar = respuesta.status !== 401 && respuesta.status !== 403;
      const esperaMs = respuesta.status === 429 ? esperaTrasRateLimit(respuesta, detalle) : undefined;
      return { ok: false, reintentar, motivo: `HTTP ${respuesta.status} ${detalle}`, esperaMs };
    }

    const datos = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
    const contenido = datos.choices?.[0]?.message?.content;
    if (!contenido) return { ok: false, reintentar: true, motivo: "respuesta vacía" };
    return { ok: true, contenido };
  } catch (error) {
    return { ok: false, reintentar: true, motivo: `red: ${String(error)}` };
  }
}

export async function llamarOpenRouter(
  mensajes: MensajeGroq[],
  opciones: OpcionesOpenRouter = {},
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[openrouter] Falta OPENROUTER_API_KEY en el entorno.");
    return null;
  }

  const modelos = opciones.modelos ?? MODELOS;
  for (const modelo of modelos) {
    for (let intento = 0; ; intento++) {
      const resultado = await intentarModelo(apiKey, modelo, mensajes, opciones);
      if (resultado.ok) return resultado.contenido;

      if (!resultado.reintentar) {
        console.error(`[openrouter] Error no recuperable con ${modelo}: ${resultado.motivo}`);
        return null;
      }

      if (
        resultado.esperaMs != null &&
        resultado.esperaMs <= TOPE_ESPERA_MS &&
        intento < MAX_REINTENTOS_429
      ) {
        console.warn(`[openrouter] ${modelo} rate-limited; reintento en ${resultado.esperaMs}ms...`);
        await dormir(resultado.esperaMs + 150);
        continue;
      }

      console.warn(`[openrouter] ${modelo} falló (${resultado.motivo}). Probando el siguiente...`);
      break;
    }
  }

  console.error("[openrouter] Todos los modelos de la cadena fallaron.");
  return null;
}

const MODELOS_VISION: string[] = [
  "openai/gpt-4.1-nano",
  "qwen/qwen3.6-27b",
];

const TOPE_ESPERA_VISION_MS = 12000;

export async function llamarOpenRouterVision(
  prompt: string,
  imagenes: string[],
  rotacion = 0,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const contenido = [
    { type: "text", text: prompt },
    ...imagenes.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const cadena = MODELOS_VISION.map(
    (_, i) => MODELOS_VISION[(i + rotacion) % MODELOS_VISION.length],
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL;
  }
  headers["X-Title"] = "Homologaciones";

  for (const modelo of cadena) {
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelo,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: contenido }],
          }),
        });

        if (respuesta.ok) {
          const datos = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
          const c = datos.choices?.[0]?.message?.content;
          if (c) return c;
          console.warn(`[openrouter-vision] ${modelo} respondió vacío.`);
          break;
        }

        const detalle = await respuesta.text();
        if (respuesta.status === 401 || respuesta.status === 403) {
          console.error(`[openrouter-vision] Credencial inválida: ${detalle}`);
          return null;
        }

        if (respuesta.status === 429 && intento < MAX_REINTENTOS_429) {
          const espera = esperaTrasRateLimit(respuesta, detalle);
          if (espera <= TOPE_ESPERA_VISION_MS) {
            console.warn(`[openrouter-vision] rate-limited; reintento en ${espera}ms...`);
            await dormir(espera + 250);
            continue;
          }
        }

        console.warn(`[openrouter-vision] ${modelo} falló (HTTP ${respuesta.status}).`);
        break;
      } catch (error) {
        console.warn(`[openrouter-vision] ${modelo} falló por red (${String(error)}).`);
        break;
      }
    }
  }

  console.error("[openrouter-vision] Todos los modelos de visión fallaron.");
  return null;
}
