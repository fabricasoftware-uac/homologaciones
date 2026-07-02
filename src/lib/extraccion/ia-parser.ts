import { extraerMateriasDeTexto, extraerMateriasPorVision } from "@/lib/groq/extraer-materias";
import type { MateriaExtraida, Extractor } from "./tipos";

export class ParserIA implements Extractor {
  readonly nombre = "ParserIA";

  async extraer(texto: string, bytes?: Uint8Array): Promise<MateriaExtraida[]> {
    const MIN_TEXTO_LEGIBLE = 30;

    if (texto.trim().length >= MIN_TEXTO_LEGIBLE) {
      console.log("[extraccion] ParserIA: usando extracción por texto.");
      return extraerMateriasDeTexto(texto);
    }

    if (bytes) {
      console.log("[extraccion] ParserIA: usando extracción por visión (OCR).");
      return extraerMateriasPorVision(bytes);
    }

    console.warn("[extraccion] ParserIA: sin texto suficiente y sin bytes, devolviendo vacío.");
    return [];
  }
}
