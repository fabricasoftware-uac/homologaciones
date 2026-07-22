// Cliente de bajo nivel para OpenRouter (API compatible con la de OpenAI).
//
// SOLO debe importarse desde código de servidor (Server Actions, Route Handlers): lee la
// OPENROUTER_API_KEY del entorno y, si llegara al navegador, la expondría.
//
// OpenRouter es el ÚNICO proveedor principal del proyecto (reemplazó a Groq). Gemini queda como
// último recurso y como generador de embeddings (OpenRouter no ofrece embeddings).
//
// ── PLAN GRATUITO: LO QUE HAY QUE SABER ──
// Los modelos con sufijo ":free" no cuestan nada, pero comparten una cuota DIARIA por CUENTA
// (~50 requests/día sin créditos comprados; ~1000/día si la cuenta compró créditos alguna vez).
// Dos consecuencias de diseño:
//   1. La cuota es de la CUENTA, no del modelo. Cuando se agota, saltar al siguiente modelo de la
//      cadena es inútil: fallaría igual y quemaría segundos. Por eso detectamos ese 429 concreto y
//      cortamos en seco (ver esLimiteDiario) para que el llamador caiga a Gemini de una vez.
//   2. Cada llamada cuenta. El pipeline debe resolver lo máximo posible sin IA (parser
//      determinístico del SENA, caché de decisiones, regla de nombre, vectores).
//
// Cuando haya créditos, basta con cambiar las constantes de MODELOS_* por sus versiones de pago
// (los mismos IDs sin ":free", o modelos mejores): el resto del código no cambia.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Se lanza cuando NINGÚN modelo de la cadena logró responder (cuota agotada, servicio caído).
// Es distinto de "la IA respondió pero sin resultados": esto significa que no pudimos ni preguntar,
// y quien orquesta el pipeline lo usa para AVISARLE al usuario (por sileo) que el análisis
// automático no está disponible, en vez de tragarse el fallo en silencio.
export class ErrorIANoDisponible extends Error {
  constructor(mensaje = "El servicio de IA no está disponible en este momento.") {
    super(mensaje);
    this.name = "ErrorIANoDisponible";
  }
}

const MAX_REINTENTOS_429 = 2;
const TOPE_ESPERA_MS = 2500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cuánto pide esperar OpenRouter ante un 429: primero el header retry-after (segundos); si no, lo
// saca del mensaje ("try again in 577.5ms" / "in 2.5s"). Por defecto, 1s.
function esperaTrasRateLimit(respuesta: Response, detalle: string): number {
  const header = respuesta.headers.get("retry-after");
  if (header && Number.isFinite(Number(header))) return Math.ceil(Number(header) * 1000);
  const m = detalle.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (m && Number.isFinite(Number(m[1]))) {
    return m[2].toLowerCase() === "s" ? Math.ceil(Number(m[1]) * 1000) : Math.ceil(Number(m[1]));
  }
  return 1000;
}

// Los 429 de OpenRouter NO son todos iguales, y confundirlos cuesta minutos de espera. Hay tres
// clases, cada una con su reacción correcta (ambas medidas contra el servicio real):
//
//   1. CUOTA DIARIA de la cuenta ("free-models-per-day", "add N credits"). Es de la CUENTA, no del
//      modelo → ningún otro modelo va a responder. Se corta la cadena y se cae a Gemini de una vez.
//
//   2. PROVEEDOR SATURADO ("X:free is temporarily rate-limited upstream, please retry shortly"). Es
//      el proveedor de fondo de ESE modelo, congestionado. NO se arregla esperando un segundo:
//      medido, reintentar aquí llevó una constancia de 14 s a 123 s, porque cada lote quemaba tres
//      intentos por modelo antes de rendirse. Lo correcto es saltar al siguiente modelo YA (corre en
//      otro proveedor) y, si tampoco, a Gemini.
//
//   3. RATE-LIMIT PROPIO con retry-after corto. Ese sí se espera y se reintenta el mismo modelo.
type ClaseRateLimit = "cuota-diaria" | "proveedor-saturado" | "reintentable";

function clasificarRateLimit(detalle: string): ClaseRateLimit {
  if (/free-models-per-day|daily limit|requests per day|add \d+ credits/i.test(detalle)) {
    return "cuota-diaria";
  }
  if (/rate-limited upstream|temporarily rate-limited/i.test(detalle)) {
    return "proveedor-saturado";
  }
  return "reintentable";
}

// ── Cadenas de modelos ──
//
// Elegidos probando el payload REAL de homologación SENA (competencias con resultados de
// aprendizaje × asignaturas del pensum) contra el catálogo vigente de OpenRouter (jul-2026):
//
//   google/gemma-4-26b-a4b-it:free → GANADOR. JSON válido y estable, 262k de contexto, y lo más
//     importante: sus similitudes vienen CALIBRADAS (95 para una equivalencia clara, 70 para una
//     parcial) en vez de un valor plano. Además rechaza las equivalencias forzadas —no homologa
//     Cálculo I/II desde una competencia de matemáticas básicas—, que es justo lo que el
//     coordinador revisa. Es multimodal, así que también sirve para el camino de visión (OCR).
//   openai/gpt-oss-20b:free → respaldo. JSON estable, pero devuelve 80% en TODO (similitud sin
//     calibrar) y es demasiado generoso homologando. Sirve para no quedarnos sin respuesta.
//
// DESCARTADOS (probados, no usar): nvidia/nemotron-3-super-120b:free razona en voz alta hasta
// agotar max_tokens y nunca emite el JSON (el mismo fallo que tenía qwen en Groq).
const MODELOS: string[] = [
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
];

// Cadena LIGERA para tareas de comparación por índices (emparejamiento). Hoy es la misma que la
// principal: en el plan gratuito la cuota es por cuenta, así que repartir entre modelos no aporta
// nada (a diferencia de Groq, donde el límite era POR MODELO y separar las cadenas sí ayudaba).
// Se mantiene como export aparte para que, al pasar a créditos, se pueda abaratar solo esta.
export const MODELOS_LIGEROS: string[] = MODELOS;

// Modelos multimodales para leer PDFs ESCANEADOS (sin capa de texto). gemma-4 encabeza por ser el
// mismo que ya valida bien el JSON; gemma-4-31b es el hermano denso; nemotron-nano-12b-vl es de
// otra familia, como última red por si un problema afecta a toda la familia gemma.
const MODELOS_VISION: string[] = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

// Las peticiones de visión son GRANDES (una imagen de página completa consume miles de tokens), así
// que cuando el proveedor pide esperar tras un 429 suele ser cuestión de segundos, no de
// milisegundos. Aquí vale la pena aguantar más que en texto: la alternativa es perder la página.
const TOPE_ESPERA_VISION_MS = 12000;

// El nombre del tipo conserva la forma de mensajes de la API de OpenAI (role + content).
export type MensajeIA = { role: "system" | "user" | "assistant"; content: string };

export type OpcionesOpenRouter = {
  modelos?: string[]; // override de la cadena (por defecto, MODELOS)
  temperatura?: number;
  json?: boolean; // pide la respuesta en formato JSON (response_format: json_object)
  maxTokens?: number; // máximo de tokens de salida
  // Cuánto aguantar la espera que pide un 429 antes de saltar al siguiente modelo. El default está
  // pensado para llamadas interactivas; la EXTRACCIÓN de un pensum corre en una server action con
  // maxDuration 60 y le conviene esperar más.
  topeEsperaMs?: number;
  // Control del razonamiento. En tareas MECÁNICAS (extraer listas a JSON) conviene "low" o
  // desactivarlo: si el modelo razona sin límite, el razonamiento se come el presupuesto de
  // max_tokens y la respuesta sale truncada o vacía.
  esfuerzoRazonamiento?: "low" | "medium" | "high" | "off";
};

type IntentoResultado =
  | { ok: true; contenido: string }
  | { ok: false; reintentar: boolean; motivo: string; esperaMs?: number; abortarCadena?: boolean };

function cabeceras(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    // OpenRouter usa estos dos para atribuir el tráfico en su ranking público. Son opcionales.
    "X-Title": "Homologaciones",
  };
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL;
  }
  return headers;
}

// Traduce nuestra opción de razonamiento al cuerpo que espera OpenRouter. "off" lo desactiva del
// todo; los demás valores fijan el esfuerzo. Si no se especifica, no mandamos nada y cada modelo
// usa su default.
function bloqueRazonamiento(esfuerzo: OpcionesOpenRouter["esfuerzoRazonamiento"]) {
  if (!esfuerzo) return {};
  if (esfuerzo === "off") return { reasoning: { enabled: false } };
  return { reasoning: { effort: esfuerzo } };
}

// Un intento con UN modelo. Decide si vale la pena pasar al siguiente:
//   - 401/403 (credencial) -> NO: la misma key falla en todos.
//   - 429 de cuota DIARIA  -> NO: la cuota es de la cuenta, no del modelo.
//   - resto (429 pasajero, 400/404 modelo retirado, 5xx, red, respuesta vacía) -> SÍ.
async function intentarModelo(
  apiKey: string,
  modelo: string,
  mensajes: MensajeIA[],
  opciones: OpcionesOpenRouter,
): Promise<IntentoResultado> {
  try {
    const respuesta = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: cabeceras(apiKey),
      body: JSON.stringify({
        model: modelo,
        temperature: opciones.temperatura ?? 0,
        ...bloqueRazonamiento(opciones.esfuerzoRazonamiento),
        ...(opciones.json ? { response_format: { type: "json_object" } } : {}),
        ...(opciones.maxTokens ? { max_tokens: opciones.maxTokens } : {}),
        messages: mensajes,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      const credencial = respuesta.status === 401 || respuesta.status === 403;
      const clase = respuesta.status === 429 ? clasificarRateLimit(detalle) : null;
      // Solo esperamos y reintentamos el MISMO modelo ante un rate-limit propio y corto. Con el
      // proveedor saturado, esperar es tiempo tirado: se salta al siguiente modelo sin pausa.
      const esperaMs =
        clase === "reintentable" ? esperaTrasRateLimit(respuesta, detalle) : undefined;
      return {
        ok: false,
        reintentar: !credencial && clase !== "cuota-diaria",
        abortarCadena: credencial || clase === "cuota-diaria",
        motivo:
          clase === "proveedor-saturado"
            ? `HTTP 429 proveedor saturado (se salta al siguiente modelo sin esperar)`
            : `HTTP ${respuesta.status} ${detalle.slice(0, 300)}`,
        esperaMs,
      };
    }

    const datos = (await respuesta.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      error?: { message?: string };
    };
    // OpenRouter puede devolver 200 con un error del proveedor de fondo en el cuerpo.
    if (datos.error) {
      return { ok: false, reintentar: true, motivo: `error del proveedor: ${datos.error.message ?? ""}` };
    }

    const eleccion = datos.choices?.[0];
    const contenido = eleccion?.message?.content;
    if (!contenido) return { ok: false, reintentar: true, motivo: "respuesta vacía" };
    // Truncado por presupuesto de salida: el JSON viene cortado y no parseará. Avisamos para que se
    // vea en los logs (la causa real suele ser un maxTokens corto o razonamiento sin límite).
    if (eleccion?.finish_reason === "length") {
      console.warn(`[openrouter] ${modelo} truncó la respuesta (finish_reason=length); sube maxTokens.`);
    }
    return { ok: true, contenido };
  } catch (error) {
    return { ok: false, reintentar: true, motivo: `red: ${String(error)}` };
  }
}

// Llama a OpenRouter probando la cadena de modelos en orden. Devuelve el contenido del primer
// modelo que responda, o null si todos fallan. NO lanza: quien llama decide la política ante un
// null (normalmente, caer a Gemini).
export async function llamarOpenRouter(
  mensajes: MensajeIA[],
  opciones: OpcionesOpenRouter = {},
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[openrouter] Falta OPENROUTER_API_KEY en el entorno.");
    return null;
  }

  const modelos = opciones.modelos ?? MODELOS;
  for (const modelo of modelos) {
    for (let intento = 0; ; intento++) {
      const resultado = await intentarModelo(apiKey, modelo, mensajes, opciones);
      if (resultado.ok) return resultado.contenido;

      if (resultado.abortarCadena) {
        console.error(`[openrouter] Se corta la cadena en ${modelo}: ${resultado.motivo}`);
        return null;
      }

      // 429 con espera CORTA: dormimos lo que pide el proveedor y reintentamos el MISMO modelo.
      // Si la espera es larga o se acaban los reintentos, pasamos al siguiente.
      if (
        resultado.esperaMs != null &&
        resultado.esperaMs <= (opciones.topeEsperaMs ?? TOPE_ESPERA_MS) &&
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

// Llama a OpenRouter con un prompt de texto + imágenes (data URLs). Devuelve el contenido del
// primer modelo que responda, o null. Pide la respuesta en JSON.
//
// `rotacion` reparte la carga entre los modelos de visión (round-robin): quien procesa varias
// páginas va rotando el modelo inicial (página 1 -> gemma-26b, página 2 -> gemma-31b, ...) para no
// golpear siempre al mismo primero.
export async function llamarOpenRouterVision(
  prompt: string,
  imagenes: string[],
  rotacion = 0,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[openrouter-vision] Falta OPENROUTER_API_KEY en el entorno.");
    return null;
  }

  const contenido = [
    { type: "text", text: prompt },
    ...imagenes.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  // Cadena rotada: empieza por el modelo que toca según la página, el resto quedan de respaldo.
  const cadena = MODELOS_VISION.map(
    (_, i) => MODELOS_VISION[(i + rotacion) % MODELOS_VISION.length],
  );

  for (const modelo of cadena) {
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: cabeceras(apiKey),
          body: JSON.stringify({
            model: modelo,
            temperature: 0,
            response_format: { type: "json_object" },
            max_tokens: 4000,
            messages: [{ role: "user", content: contenido }],
          }),
        });

        if (respuesta.ok) {
          const datos = (await respuesta.json()) as {
            choices?: { message?: { content?: string } }[];
            error?: { message?: string };
          };
          const c = datos.choices?.[0]?.message?.content;
          if (c) return c;
          console.warn(
            `[openrouter-vision] ${modelo} respondió vacío${datos.error ? ` (${datos.error.message})` : ""}. Probando el siguiente...`,
          );
          break;
        }

        const detalle = await respuesta.text();
        if (respuesta.status === 401 || respuesta.status === 403) {
          console.error(`[openrouter-vision] Credencial inválida: ${detalle.slice(0, 200)}`);
          return null;
        }
        // Mismas tres clases de 429 que en texto (ver clasificarRateLimit).
        const clase = respuesta.status === 429 ? clasificarRateLimit(detalle) : null;
        if (clase === "cuota-diaria") {
          console.error("[openrouter-vision] Cuota diaria de modelos gratis agotada; se corta la cadena.");
          return null;
        }
        if (clase === "proveedor-saturado") {
          console.warn(`[openrouter-vision] ${modelo}: proveedor saturado; al siguiente modelo sin esperar.`);
          break;
        }

        if (clase === "reintentable" && intento < MAX_REINTENTOS_429) {
          const espera = esperaTrasRateLimit(respuesta, detalle);
          if (espera <= TOPE_ESPERA_VISION_MS) {
            console.warn(`[openrouter-vision] ${modelo} rate-limited; reintento en ${espera}ms...`);
            await dormir(espera + 250);
            continue;
          }
        }

        console.warn(
          `[openrouter-vision] ${modelo} falló (HTTP ${respuesta.status}). Probando el siguiente...`,
        );
        break;
      } catch (error) {
        console.warn(`[openrouter-vision] ${modelo} falló por red (${String(error)}). Probando el siguiente...`);
        break;
      }
    }
  }

  console.error("[openrouter-vision] Todos los modelos de visión fallaron.");
  return null;
}
