import { GoogleGenAI } from "@google/genai";

const crearCliente = () => {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    console.error("[gemini] Falta GOOGLE_GENAI_API_KEY en el entorno.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export class ErrorIANoDisponible extends Error {
  constructor(mensaje = "El servicio de IA no está disponible en este momento.") {
    super(mensaje);
    this.name = "ErrorIANoDisponible";
  }
}

const MAX_REINTENTOS_429 = 2;
const TOPE_ESPERA_MS = 2500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function esperaTrasRateLimit(mensaje: string): number {
  const m = mensaje.match(/(\d+(?:\.\d+)?)\s*(?:second|s)\b/i);
  if (m && Number.isFinite(Number(m[1]))) return Math.ceil(Number(m[1]) * 1000);
  return 1000;
}

function esCodigoRateLimit(detalle: string): boolean {
  return /429|RESOURCE_EXHAUSTED|quota/i.test(detalle);
}

const MODELOS: string[] = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

export const MODELOS_LIGEROS: string[] = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

export type MensajeGemini = { role: "system" | "user" | "assistant"; content: string };

export type OpcionesGemini = {
  modelos?: string[];
  temperatura?: number;
  json?: boolean;
  maxTokens?: number;
  // Apaga el "thinking" de los modelos 2.5 (thinkingBudget: 0). CLAVE en extracciones con salida
  // JSON larga: el thinking DESCUENTA de maxOutputTokens, así que un pensum de 50+ asignaturas
  // salía truncado (el modelo gastaba el presupuesto pensando y cortaba el JSON a la mitad).
  sinRazonar?: boolean;
};

export async function llamarGemini(
  mensajes: MensajeGemini[],
  opciones: OpcionesGemini = {},
): Promise<string | null> {
  const ai = crearCliente();
  if (!ai) return null;

  const systemMsg = mensajes.find((m) => m.role === "system");
  const conversation = mensajes.filter((m) => m.role !== "system");

  const config: Record<string, unknown> = {
    temperature: opciones.temperatura ?? 0,
  };
  if (systemMsg) {
    config.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }
  if (opciones.json) {
    config.responseMimeType = "application/json";
  }
  if (opciones.maxTokens) {
    config.maxOutputTokens = opciones.maxTokens;
  }
  if (opciones.sinRazonar) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  const contents = conversation.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const modelos = opciones.modelos ?? MODELOS;

  for (const modelo of modelos) {
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await ai.models.generateContent({
          model: modelo,
          contents,
          config: config as Parameters<typeof ai.models.generateContent>[0]["config"],
        });

        const texto = respuesta.text;
        if (texto) return texto;

        console.warn(`[gemini] ${modelo} respondió vacío. Probando el siguiente...`);
        break;
      } catch (error) {
        const detalle = error instanceof Error ? error.message : String(error);

        if (/401|403|API_KEY_INVALID/i.test(detalle)) {
          console.error(`[gemini] Credencial inválida: ${detalle}`);
          return null;
        }

        if (esCodigoRateLimit(detalle) && intento < MAX_REINTENTOS_429) {
          const espera = esperaTrasRateLimit(detalle);
          if (espera <= TOPE_ESPERA_MS) {
            console.warn(`[gemini] ${modelo} rate-limited; reintento en ${espera}ms...`);
            await dormir(espera + 150);
            continue;
          }
        }

        console.warn(`[gemini] ${modelo} falló (${detalle}). Probando el siguiente...`);
        break;
      }
    }
  }

  console.error("[gemini] Todos los modelos de la cadena fallaron.");
  return null;
}

const MODELOS_VISION: string[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

const TOPE_ESPERA_VISION_MS = 12000;

function dataUrlAInlineData(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function llamarGeminiVision(
  prompt: string,
  imagenes: string[],
  rotacion = 0,
): Promise<string | null> {
  const ai = crearCliente();
  if (!ai) return null;

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const img of imagenes) {
    const parsed = dataUrlAInlineData(img);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    } else {
      parts.push({ fileData: { fileUri: img } });
    }
  }

  const cadena = MODELOS_VISION.map(
    (_, i) => MODELOS_VISION[(i + rotacion) % MODELOS_VISION.length],
  );

  for (const modelo of cadena) {
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await ai.models.generateContent({
          model: modelo,
          contents: [{ role: "user", parts: parts as { text?: string; inlineData?: { mimeType: string; data: string } }[] }],
          config: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        });

        const texto = respuesta.text;
        if (texto) return texto;

        console.warn(`[gemini-vision] ${modelo} respondió vacío. Probando el siguiente...`);
        break;
      } catch (error) {
        const detalle = error instanceof Error ? error.message : String(error);

        if (/401|403|API_KEY_INVALID/i.test(detalle)) {
          console.error(`[gemini-vision] Credencial inválida: ${detalle}`);
          return null;
        }

        if (esCodigoRateLimit(detalle) && intento < MAX_REINTENTOS_429) {
          const espera = esperaTrasRateLimit(detalle);
          if (espera <= TOPE_ESPERA_VISION_MS) {
            console.warn(`[gemini-vision] ${modelo} rate-limited; reintento en ${espera}ms...`);
            await dormir(espera + 250);
            continue;
          }
        }

        console.warn(`[gemini-vision] ${modelo} falló (${detalle}). Probando el siguiente...`);
        break;
      }
    }
  }

  console.error("[gemini-vision] Todos los modelos de visión fallaron.");
  return null;
}

// ── Embeddings (FASE 5) ──
//
// Genera embeddings con Gemini text-embedding-004 (768 dimensiones). Se usan para preparar la
// búsqueda semántica de la Fase 6 (mandar a la IA solo el Top-N de candidatos en vez del producto
// cruzado completo). Aquí SOLO se generan los vectores; no se hace ninguna búsqueda.

// gemini-embedding-001 es el modelo de embeddings vigente (text-embedding-004 fue retirado). Devuelve
// 3072 dims por defecto, pero admite dimensión configurable: pedimos 768 para que calce con la columna
// vector(768). taskType SEMANTIC_SIMILARITY es el indicado para comparar unidades por similitud (lo
// usamos igual en origen y destino). Nota: para cosine (<=>, que usa la Fase 6) no hace falta
// normalizar el vector truncado; el operador es invariante a la magnitud.
const MODELO_EMBEDDING = "gemini-embedding-001";
export const DIMENSION_EMBEDDING = 768;
const CONFIG_EMBEDDING = {
  outputDimensionality: DIMENSION_EMBEDDING,
  taskType: "SEMANTIC_SIMILARITY",
} as const;

async function embedirUno(ai: GoogleGenAI, texto: string): Promise<number[] | null> {
  try {
    const resp = await ai.models.embedContent({ model: MODELO_EMBEDDING, contents: texto, config: CONFIG_EMBEDDING });
    const values = resp.embeddings?.[0]?.values;
    return Array.isArray(values) && values.length > 0 ? values : null;
  } catch {
    return null;
  }
}

// Genera embeddings para una lista de textos. Devuelve un arreglo ALINEADO con la entrada (mismo
// orden, misma longitud); `null` en las posiciones que fallen. Es BEST-EFFORT: la generación de
// embeddings NUNCA debe romper el pipeline —sin GOOGLE_GENAI_API_KEY o si la API falla, devuelve
// null y el resto del flujo (extracción, matching) sigue igual—.
export async function generarEmbeddings(textos: string[]): Promise<(number[] | null)[]> {
  if (textos.length === 0) return [];

  const ai = crearCliente();
  if (!ai) {
    console.error("[gemini-embed] Sin GOOGLE_GENAI_API_KEY: no se generan embeddings.");
    return textos.map(() => null);
  }

  const LOTE = 100; // text-embedding-004 admite lotes; cortamos por si llegan muchas unidades.
  const resultado: (number[] | null)[] = [];

  for (let i = 0; i < textos.length; i += LOTE) {
    const lote = textos.slice(i, i + LOTE);
    try {
      const resp = await ai.models.embedContent({ model: MODELO_EMBEDDING, contents: lote, config: CONFIG_EMBEDDING });
      const embs = resp.embeddings ?? [];
      if (embs.length === lote.length) {
        for (const e of embs) {
          const values = e?.values;
          resultado.push(Array.isArray(values) && values.length > 0 ? values : null);
        }
      } else {
        // La API no devolvió uno por texto: caemos a uno por uno para no desalinear el resultado.
        console.warn(`[gemini-embed] Batch desalineado (${embs.length}/${lote.length}); uno por uno.`);
        for (const t of lote) resultado.push(await embedirUno(ai, t));
      }
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      console.warn(`[gemini-embed] Lote falló (${detalle}); esas unidades quedan sin embedding.`);
      for (let j = 0; j < lote.length; j++) resultado.push(null);
    }
  }

  return resultado;
}
