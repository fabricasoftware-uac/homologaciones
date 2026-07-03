import { extraerMateriasDeTexto, extraerMateriasPorVision } from "@/lib/groq/extraer-materias";
import { evaluarCalidadTexto } from "./calidad";
import type { MateriaExtraida, Extractor } from "./tipos";

export class ParserIA implements Extractor {
  readonly nombre = "ParserIA";

  async extraer(texto: string, bytes?: Uint8Array): Promise<MateriaExtraida[]> {
    // Quality Gate: no basta con que haya texto; tiene que ser USABLE (no gibberish de fuentes
    // rotas, no texto sin espacios). Si no pasa, vamos a visión (OCR) igual que si fuera escaneado.
    const calidad = evaluarCalidadTexto(texto);

    if (calidad.usable) {
      console.log("[extraccion] ParserIA: usando extracción por texto.");
      return extraerMateriasDeTexto(texto);
    }

    if (bytes) {
      console.log(`[extraccion] ParserIA: texto no usable (${calidad.motivo}) → visión (OCR).`);
      return extraerMateriasPorVision(bytes);
    }

    console.warn(`[extraccion] ParserIA: texto no usable (${calidad.motivo}) y sin bytes; vacío.`);
    return [];
  }
}
