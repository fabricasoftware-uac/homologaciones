// Cliente de bajo nivel para Groq (su API es compatible con la de OpenAI).
//
// SOLO debe importarse desde código de servidor (Server Actions, Route Handlers): lee la
// GROQ_API_KEY del entorno y, si llegara al navegador, la expondría.
//
// Resiliencia: en vez de un solo modelo, recorremos una CADENA de modelos. Si uno falla por
// rate-limit / cuota agotada / modelo decomisionado, pasamos al siguiente. Los límites de Groq son
// POR MODELO, así que cambiar de modelo de verdad ayuda cuando se satura el primero.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Se lanza cuando NINGÚN modelo de la cadena logró responder (rate-limit / cuota o tokens agotados /
// servicio caído). Es distinto de "la IA respondió pero sin resultados": esto significa que no
// pudimos ni preguntar, y quien orquesta el pipeline lo usa para AVISARLE al usuario (por sileo) que
// el análisis automático no está disponible, en vez de tragarse el fallo en silencio.
export class ErrorIANoDisponible extends Error {
  constructor(mensaje = "El servicio de IA no está disponible en este momento.") {
    super(mensaje);
    this.name = "ErrorIANoDisponible";
  }
}

// Reintento ante 429 (rate limit por tokens/min). Groq dice cuánto esperar y a menudo son
// MILISEGUNDOS (p. ej. "try again in 577.5ms"): respetamos esa espera y reintentamos el MISMO modelo,
// porque su cupo se libera enseguida. Si la espera fuera larga, no aguantamos aquí (para no exceder el
// timeout de la función en Vercel) y pasamos al siguiente modelo, que tiene su propio cupo.
const MAX_REINTENTOS_429 = 2;
const TOPE_ESPERA_MS = 2500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cuánto pide esperar Groq ante un 429: primero el header retry-after (segundos); si no, lo saca del
// mensaje ("try again in 577.5ms" / "in 2.5s"). Por defecto, 1s.
function esperaTrasRateLimit(respuesta: Response, detalle: string): number {
  const header = respuesta.headers.get("retry-after");
  if (header && Number.isFinite(Number(header))) return Math.ceil(Number(header) * 1000);
  const m = detalle.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (m && Number.isFinite(Number(m[1]))) {
    return m[2].toLowerCase() === "s" ? Math.ceil(Number(m[1]) * 1000) : Math.ceil(Number(m[1]));
  }
  return 1000;
}

// Orden de preferencia (calidad primero). Los tres son modelos VIGENTES de Groq (verificado contra
// su tabla de deprecaciones, jul-2026) y todos soportan JSON mode. La familia gpt-oss va primero y
// qwen3.6 cierra como red de una familia distinta, por si un problema afecta a toda una familia. Si
// uno se satura por rate-limit/cuota, el loop pasa al siguiente. La cadena anterior (llama-3.3,
// llama-4-scout, qwen3-32b, llama-3.1) quedó obsoleta: Groq la apaga entre jul y ago de 2026.
const MODELOS: string[] = [
  "openai/gpt-oss-120b", // el más capaz de la familia gpt-oss
  "openai/gpt-oss-20b", // más rápido y barato; buen relevo si el 120b está saturado
  "qwen/qwen3.6-27b", // familia distinta (multimodal) como última red
];

export type MensajeGroq = { role: "system" | "user" | "assistant"; content: string };

export type OpcionesGroq = {
  modelos?: string[]; // override de la cadena de modelos (por defecto, MODELOS)
  temperatura?: number;
  json?: boolean; // pide la respuesta en formato JSON (response_format: json_object)
};

type IntentoResultado =
  | { ok: true; contenido: string }
  | { ok: false; reintentar: boolean; motivo: string; esperaMs?: number };

// Un intento con UN modelo. Decide si vale la pena pasar al siguiente:
//   - 401/403 (credencial) -> NO: la misma key falla en todos.
//   - resto (429 cuota, 400/404 decomisionado, 5xx, red, respuesta vacía) -> SÍ: probar el siguiente.
async function intentarModelo(
  apiKey: string,
  modelo: string,
  mensajes: MensajeGroq[],
  opciones: OpcionesGroq,
): Promise<IntentoResultado> {
  try {
    const respuesta = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        temperature: opciones.temperatura ?? 0,
        ...(opciones.json ? { response_format: { type: "json_object" } } : {}),
        messages: mensajes,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      const reintentar = respuesta.status !== 401 && respuesta.status !== 403;
      const esperaMs = respuesta.status === 429 ? esperaTrasRateLimit(respuesta, detalle) : undefined;
      return { ok: false, reintentar, motivo: `HTTP ${respuesta.status} ${detalle}`, esperaMs };
    }

    const datos = (await respuesta.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contenido = datos.choices?.[0]?.message?.content;
    if (!contenido) return { ok: false, reintentar: true, motivo: "respuesta vacía" };
    return { ok: true, contenido };
  } catch (error) {
    return { ok: false, reintentar: true, motivo: `red: ${String(error)}` };
  }
}

// Llama a Groq probando la cadena de modelos en orden. Devuelve el contenido del primer modelo que
// responda, o null si todos fallan (o si la credencial es inválida). NO lanza: quien llama decide la
// política ante un null (dejar pasar o bloquear).
export async function llamarGroq(
  mensajes: MensajeGroq[],
  opciones: OpcionesGroq = {},
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[groq] Falta GROQ_API_KEY en el entorno.");
    return null;
  }

  const modelos = opciones.modelos ?? MODELOS;
  for (const modelo of modelos) {
    for (let intento = 0; ; intento++) {
      const resultado = await intentarModelo(apiKey, modelo, mensajes, opciones);
      if (resultado.ok) return resultado.contenido;

      if (!resultado.reintentar) {
        console.error(`[groq] Error no recuperable con ${modelo}: ${resultado.motivo}`);
        return null;
      }

      // 429 con espera CORTA: dormimos lo que pide Groq y reintentamos el MISMO modelo (su cupo se
      // libera en el acto). Si la espera es larga o se acaban los reintentos, pasamos al siguiente.
      if (
        resultado.esperaMs != null &&
        resultado.esperaMs <= TOPE_ESPERA_MS &&
        intento < MAX_REINTENTOS_429
      ) {
        console.warn(`[groq] ${modelo} rate-limited; reintento en ${resultado.esperaMs}ms...`);
        await dormir(resultado.esperaMs + 150);
        continue;
      }

      console.warn(`[groq] El modelo ${modelo} falló (${resultado.motivo}). Probando el siguiente...`);
      break;
    }
  }

  console.error("[groq] Todos los modelos de la cadena fallaron.");
  return null;
}

// Modelos multimodales (visión) para leer PDFs ESCANEADOS (sin capa de texto): se les pasa la imagen
// de las páginas y devuelven el contenido. qwen/qwen3.6-27b es el único modelo con visión que sigue
// vigente en Groq (los llama-4 quedaron decomisionados en 2026); hace OCR/lectura de imágenes y
// soporta JSON mode.
//
// OJO (verificado contra la API): este modelo admite MÁXIMO 3 imágenes por petición, y varias páginas
// de alta resolución en una sola llamada agotan el límite de tokens/min (413). Por eso los llamadores
// mandan UNA imagen por llamada y fusionan (ver extraerMateriasPorVision / extraerAsignaturasPorVision).
const MODELOS_VISION = ["qwen/qwen3.6-27b"];

// Llama a Groq con un prompt de texto + imágenes (data URLs). Devuelve el contenido del primer
// modelo que responda, o null. Pide la respuesta en JSON.
export async function llamarGroqVision(prompt: string, imagenes: string[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[groq] Falta GROQ_API_KEY en el entorno.");
    return null;
  }

  const contenido = [
    { type: "text", text: prompt },
    ...imagenes.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  for (const modelo of MODELOS_VISION) {
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelo,
            temperature: 0,
            // qwen3.6 es un modelo de razonamiento: sin esto emite un bloque <think>…</think> que rompe
            // el JSON (y en modo estricto a veces devuelve vacío). "hidden" hace que razone por dentro y
            // entregue SOLO el JSON final.
            reasoning_format: "hidden",
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: contenido }],
          }),
        });
        if (respuesta.ok) {
          const datos = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
          const c = datos.choices?.[0]?.message?.content;
          if (c) return c;
          break; // respondió vacío: probamos el siguiente modelo
        }

        const detalle = await respuesta.text();
        if (respuesta.status === 401 || respuesta.status === 403) {
          console.error(`[groq-vision] Credencial inválida: ${detalle}`);
          return null;
        }

        // 429 con espera corta: esperamos y reintentamos el MISMO modelo (su cupo se libera pronto).
        if (respuesta.status === 429 && intento < MAX_REINTENTOS_429) {
          const espera = esperaTrasRateLimit(respuesta, detalle);
          if (espera <= TOPE_ESPERA_MS) {
            console.warn(`[groq-vision] ${modelo} rate-limited; reintento en ${espera}ms...`);
            await dormir(espera + 150);
            continue;
          }
        }

        console.warn(`[groq-vision] ${modelo} falló (HTTP ${respuesta.status}). Probando el siguiente...`);
        break;
      } catch (error) {
        console.warn(`[groq-vision] ${modelo} falló por red (${String(error)}). Probando el siguiente...`);
        break;
      }
    }
  }

  console.error("[groq-vision] Todos los modelos de visión fallaron.");
  return null;
}
