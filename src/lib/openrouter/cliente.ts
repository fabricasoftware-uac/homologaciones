// Cliente de bajo nivel para OpenRouter (API compatible con la de OpenAI).
//
// SOLO debe importarse desde código de servidor (Server Actions, Route Handlers): lee la
// OPENROUTER_API_KEY del entorno y, si llegara al navegador, la expondría.
//
// OpenRouter es el ÚNICO proveedor de IA del proyecto (reemplazó a Groq y a la integración directa
// con Gemini; también genera los embeddings).
//
// ── MODELOS DE PAGO, A PROPÓSITO ──
// Las cadenas MODELOS_* usan solo modelos de pago (sin sufijo ":free"). Se probaron los ":free"
// primero, pero traen dos problemas que un presupuesto chico de créditos resuelve:
//   1. Cuota DIARIA por CUENTA (no por modelo): al agotarse, TODA la cadena ":free" cae a la vez,
//      sin importar cuántos modelos de respaldo haya.
//   2. Disponibilidad del proveedor de fondo: los ":free" se sirven con menor prioridad, así que
//      es más frecuente toparse con "temporarily rate-limited upstream".
// Con modelos de pago baratos (fracciones de centavo por request, ver MODELOS más abajo) ambos
// problemas desaparecen y unos pocos dólares de crédito alcanzan para muchísimas solicitudes.
// El código de clasificación de 429 (clasificarRateLimit) se conserva igual: sigue siendo una red
// de seguridad válida si algún modelo ":free" vuelve a la cadena, y los proveedores de pago también
// pueden saturarse puntualmente.

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

// Tope de espera por petición a UN modelo. El pipeline corre dentro de una función de Vercel con
// 60 s en total (ver `export const maxDuration` en las páginas), y en un caso SENA hay que meter
// ahí la lectura del PDF, los embeddings, ~5 microlotes de emparejamiento y la estimación de
// semestre. 25 s deja margen para que, si el primer modelo se atasca, el respaldo todavía alcance
// a responder dentro del presupuesto.
const TIMEOUT_MODELO_MS = 25000;

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
// Ordenados por LATENCIA, no solo por calidad: el pipeline vive dentro de una función de Vercel con
// 60 s y el emparejamiento de un caso SENA son ~5 microlotes. Un modelo lento no es "un poco peor",
// es un caso que muere por timeout. Medidos con el payload REAL de un microlote SENA (4 competencias
// con sus resultados de aprendizaje × las 59 asignaturas del pensum), TODOS con razonamiento en
// "off" —imprescindible, ver OpcionesOpenRouter.esfuerzoRazonamiento—:
//
//   google/gemini-2.5-flash-lite → primario. 0.8-4.8 s, JSON entero, y el que más equivalencias
//     útiles encontró (18 propuestas, 12 por encima del umbral). Infraestructura de Google directa.
//   qwen/qwen3.5-flash-02-23 → respaldo 1. El más rápido (1.3 s) y el más barato del trío.
//   google/gemma-4-26b-a4b-it → respaldo 2. El más lento (10.5 s) pero el de similitudes mejor
//     calibradas; queda al final como ancla de calidad. Es multimodal, así que también va en visión.
//
// DESCARTADO (estuvo de primario y tumbó producción el 22-jul-2026): deepseek/deepseek-v4-flash.
// Razona por defecto y con esfuerzo "low" tardó 120 s en este mismo payload —el doble del
// presupuesto entero de Vercel—, además de truncar el JSON. Con razonamiento "off" baja a 3.9 s y
// responde bien, pero su varianza es justo el riesgo que no podemos correr en el camino crítico.
// DESCARTADO también: openai/gpt-5-nano, que rechaza la petición si se desactiva el razonamiento
// ("Reasoning is mandatory for this endpoint").
const MODELOS: string[] = [
  "google/gemini-2.5-flash-lite",
  "qwen/qwen3.5-flash-02-23",
  "google/gemma-4-26b-a4b-it",
];

// Cadena LIGERA para tareas de comparación por índices (emparejamiento). Hoy es la misma que la
// principal: con modelos de pago no hay cuota compartida que repartir entre cadenas (a diferencia
// de Groq, donde el límite era POR MODELO y separar las cadenas sí ayudaba). Se mantiene como
// export aparte por si conviene abaratarla o especializarla más adelante.
export const MODELOS_LIGEROS: string[] = MODELOS;

// Modelos multimodales para leer PDFs ESCANEADOS (sin capa de texto). Mismo criterio de latencia
// que en MODELOS: aquí va UNA página por petición y varias páginas comparten el presupuesto de 60 s
// de la función, así que el rápido encabeza y el lento queda de respaldo.
// deepseek-v4-flash NO sirve aquí: es texto-solo (probado, OpenRouter devuelve 404 "No endpoints
// found that support image input" apenas se le manda una imagen).
const MODELOS_VISION: string[] = [
  "google/gemini-2.5-flash-lite",
  "google/gemma-4-26b-a4b-it",
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
  // Control del razonamiento. En tareas MECÁNICAS (comparar listas, extraer a JSON) va SIEMPRE en
  // "off". No es una preferencia estética: con "low", en un microlote SENA real, gemma-4 gastó 3453
  // de sus 4000 tokens de salida razonando y devolvió el JSON cortado; con "off" gastó 0 tokens de
  // razonamiento, respondió en 897 y el JSON salió entero. El razonamiento compite contra
  // max_tokens y en estas tareas no aporta nada.
  esfuerzoRazonamiento?: "low" | "medium" | "high" | "off";
  // Tope de espera por petición. Ver TIMEOUT_MODELO_MS.
  timeoutMs?: number;
  // Comprueba que el contenido devuelto sirva ANTES de dar la cadena por resuelta. Devolver false
  // descarta ese modelo y pasa al siguiente. Quien pide JSON debería mandar siempre un validador:
  // sin él, un modelo que responde 200 con basura deja sin usar todos los respaldos.
  validar?: (contenido: string) => boolean;
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
//   - resto (429 pasajero, 400/404 modelo retirado, 5xx, red, timeout, vacía, truncada) -> SÍ.
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
      // Tope por petición: el pipeline entero corre dentro de una función de Vercel con 60 s de
      // presupuesto, así que NINGÚN modelo puede quedarse con todo. Sin esto, un modelo lento se
      // llevaba la petición completa por delante y ni siquiera se llegaba a probar el respaldo
      // (medido: deepseek-v4-flash con razonamiento tardó 120 s en un microlote SENA real).
      signal: AbortSignal.timeout(opciones.timeoutMs ?? TIMEOUT_MODELO_MS),
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

    // ── Un 200 NO significa que la respuesta sirva ──
    // Aquí estuvo la falla que tumbó producción el 22-jul-2026: una respuesta CORTADA se devolvía
    // como ok:true, la cadena se daba por resuelta con el primer modelo, y quien llamaba se
    // quedaba con un JSON roto sin haber probado los respaldos —que habrían contestado bien—.
    // Dos formas de venir cortada, ambas medidas contra el servicio real:
    //   finish_reason "length" → se agotó max_tokens (típico si el modelo razona; ver
    //     esfuerzoRazonamiento, que por eso va en "off" en todas las tareas mecánicas).
    //   finish_reason "error"  → el proveedor cortó el stream a mitad del JSON.
    const fin = eleccion?.finish_reason;
    if (fin === "length" || fin === "error") {
      return { ok: false, reintentar: true, motivo: `respuesta cortada (finish_reason=${fin})` };
    }

    // Validación del CONTENIDO, no solo del transporte. Enumerar finish_reasons no alcanza: un
    // modelo puede terminar con "stop" y aun así devolver prosa, una negativa o un JSON inválido.
    // Que la valide la CADENA (y no el llamador) es lo que hace que el respaldo sirva de algo.
    if (opciones.validar && !opciones.validar(contenido)) {
      return { ok: false, reintentar: true, motivo: "el contenido no pasó la validación del llamador" };
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
            // Mismo motivo que en el camino de texto: leer una página es una tarea mecánica (OCR a
            // JSON) y el razonamiento solo compite contra max_tokens hasta truncar la respuesta.
            reasoning: { enabled: false },
            messages: [{ role: "user", content: contenido }],
          }),
          // Las páginas van de a una por petición, pero varias páginas comparten el mismo
          // presupuesto de 60 s de la función: ningún modelo puede acaparar la petición.
          signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
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

// ── Embeddings ──
//
// Genera embeddings con openai/text-embedding-3-small, truncado a 1024 dimensiones con el parámetro
// `dimensions` (Matryoshka). OpenRouter los expone en /api/v1/embeddings con el mismo formato que la
// API de OpenAI. Se usan para la búsqueda semántica: convertir competencias y asignaturas en
// vectores para quedarse con las Top-N candidatas sin gastar tokens de LLM.
//
// POR QUÉ ESTE MODELO (medido contra el servicio real, 6 llamadas por modelo, mismo payload):
//   openai/text-embedding-3-small → 6/6 respuestas OK, SIEMPRE servidas por OpenAI.
//   qwen/qwen3-embedding-8b (el anterior) → 3/6. Los fallos llegan como HTTP 200 con el cuerpo
//     VACÍO, y encima rotaba de proveedor (Nebius/SiliconFlow) sin control.
// Además 1024 < 2000, que es el tope de pgvector para índices HNSW/ivfflat: con los 4096 dims de
// qwen no se podía indexar nunca. La separación semántica también es mejor: en pares de asignaturas
// reales da 0.64-0.68 entre afines contra 0.14-0.31 entre ajenas (qwen daba 0.87-0.92 contra
// 0.56-0.60 — números más altos, pero mucho más pegados).
//
// POR QUÉ NO HAY CADENA DE RESPALDO (al contrario que MODELOS y MODELOS_VISION):
// Dos modelos de embedding producen vectores en espacios semánticos DISTINTOS; el coseno entre uno
// y otro no significa nada. Un respaldo no fallaría de forma visible: devolvería Top-N plausibles
// pero equivocadas, que es peor que no responder. Ante el fallo devolvemos null y el motor degrada
// al camino legacy (comparar contra todo el pensum con el LLM): gasta más tokens, pero acierta.
// Si algún día se cambia de modelo hay que VACIAR los embeddings guardados (ver migración 0034),
// nunca mezclarlos.

const MODELO_EMBEDDING = "openai/text-embedding-3-small";
export const DIMENSION_EMBEDDING = 1024;

// Sin timeout, un proveedor colgado bloquea el pipeline entero: midiendo esto, una llamada quedó
// pendiente más de dos minutos sin devolver nada.
const TIMEOUT_EMBEDDING_MS = 30000;
const MAX_REINTENTOS_EMBEDDING = 2;

type LoteEmbeddings =
  | { ok: true; embeddings: (number[] | null)[] }
  | { ok: false; reintentar: boolean; motivo: string };

// Un intento con UN lote. Separa los fallos PASAJEROS (red, timeout, 5xx, y sobre todo el 200 con
// cuerpo vacío) de los definitivos (credencial inválida), que no vale la pena reintentar.
async function intentarLoteEmbeddings(apiKey: string, lote: string[]): Promise<LoteEmbeddings> {
  let respuesta: Response;
  try {
    respuesta = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: cabeceras(apiKey),
      body: JSON.stringify({
        model: MODELO_EMBEDDING,
        input: lote,
        dimensions: DIMENSION_EMBEDDING,
      }),
      signal: AbortSignal.timeout(TIMEOUT_EMBEDDING_MS),
    });
  } catch (e) {
    return { ok: false, reintentar: true, motivo: `red/timeout: ${String(e)}` };
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    const credencial = respuesta.status === 401 || respuesta.status === 403;
    return {
      ok: false,
      reintentar: !credencial,
      motivo: `HTTP ${respuesta.status} ${detalle.slice(0, 200)}`,
    };
  }

  // OJO: este endpoint devuelve a veces 200 con el cuerpo VACÍO (solo relleno de espacios para
  // mantener viva la conexión). Antes eso reventaba en respuesta.json(), caía en el catch genérico
  // y se daba por perdido el lote de 100 entero. Es un fallo PASAJERO: hay que reintentarlo.
  const crudo = (await respuesta.text().catch(() => "")).trim();
  if (!crudo) return { ok: false, reintentar: true, motivo: "200 con el cuerpo vacío" };

  let datos: { data?: { embedding: number[]; index: number }[]; error?: { message?: string } };
  try {
    datos = JSON.parse(crudo);
  } catch {
    return { ok: false, reintentar: true, motivo: `200 no parseable: ${crudo.slice(0, 120)}` };
  }
  if (datos.error) {
    return { ok: false, reintentar: true, motivo: `error del proveedor: ${datos.error.message ?? ""}` };
  }

  const embs = datos.data ?? [];
  if (embs.length !== lote.length) {
    return { ok: false, reintentar: true, motivo: `lote desalineado (${embs.length}/${lote.length})` };
  }

  // El orden de `data` no está garantizado; cada elemento trae su `index` y por ahí lo alineamos.
  const ordenados = [...embs].sort((a, b) => a.index - b.index);

  // Validamos la dimensión: un vector de otro tamaño no se puede comparar contra los que ya están
  // guardados (pgvector lanza al aplicar <=> entre dimensiones distintas) y ensuciaría la tabla.
  return {
    ok: true,
    embeddings: ordenados.map((e) => {
      if (e.embedding.length === DIMENSION_EMBEDDING) return e.embedding;
      console.warn(
        `[openrouter-embed] Vector de ${e.embedding.length} dims (se esperaban ${DIMENSION_EMBEDDING}); se descarta.`,
      );
      return null;
    }),
  };
}

export async function generarEmbeddings(textos: string[]): Promise<(number[] | null)[]> {
  if (textos.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[openrouter-embed] Falta OPENROUTER_API_KEY.");
    return textos.map(() => null);
  }

  const LOTE = 100;
  const resultado: (number[] | null)[] = [];

  for (let i = 0; i < textos.length; i += LOTE) {
    const lote = textos.slice(i, i + LOTE);
    let embeddings: (number[] | null)[] | null = null;

    for (let intento = 0; intento <= MAX_REINTENTOS_EMBEDDING; intento++) {
      const r = await intentarLoteEmbeddings(apiKey, lote);
      if (r.ok) {
        embeddings = r.embeddings;
        break;
      }
      if (!r.reintentar || intento === MAX_REINTENTOS_EMBEDDING) {
        console.warn(`[openrouter-embed] Lote perdido (${r.motivo}); quedan sin embedding.`);
        break;
      }
      const espera = 600 * (intento + 1);
      console.warn(`[openrouter-embed] Lote falló (${r.motivo}); reintento en ${espera}ms...`);
      await dormir(espera);
    }

    // Sin embeddings el pipeline NO se rompe: el motor cae al camino legacy (comparar contra todo
    // el pensum con el LLM). Cuesta más tokens, pero sigue dando un resultado correcto.
    if (embeddings) resultado.push(...embeddings);
    else for (let j = 0; j < lote.length; j++) resultado.push(null);
  }

  return resultado;
}
