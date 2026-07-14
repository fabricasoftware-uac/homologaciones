import type { FeatureExtractionPipeline } from "@xenova/transformers";

let extractor: FeatureExtractionPipeline | null = null;
let cargando = false;

async function obtenerExtractor(): Promise<FeatureExtractionPipeline | null> {
  if (extractor) return extractor;
  if (cargando) {
    while (!extractor && cargando) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return extractor;
  }
  cargando = true;
  try {
    console.log("[embedding-local] Cargando modelo (primera vez descarga ~80 MB)...");
    const { pipeline } = await import("@xenova/transformers");
    extractor = (await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
      { quantized: true },
    )) as FeatureExtractionPipeline;
    console.log("[embedding-local] Modelo listo.");
    return extractor;
  } finally {
    cargando = false;
  }
}

export const DIMENSION_EMBEDDING = 384;

export async function generarEmbeddings(textos: string[]): Promise<(number[] | null)[]> {
  if (textos.length === 0) return [];

  try {
    const ext = await obtenerExtractor();
    if (!ext) return textos.map(() => null);

    const resultado: (number[] | null)[] = [];

    for (const texto of textos) {
      try {
        const output = await ext(texto, { pooling: "mean", normalize: true });
        const list = output.tolist();
        const vec = Array.isArray(list[0]) ? list[0] : list;
        resultado.push(Array.isArray(vec) ? vec.map(Number) : null);
      } catch {
        resultado.push(null);
      }
    }

    return resultado;
  } catch (e) {
    console.warn("[embedding-local] Fallo al generar embeddings:", e);
    return textos.map(() => null);
  }
}
