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
