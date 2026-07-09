import type { MateriaExtraida } from "@/lib/groq/extraer-materias";

export type { MateriaExtraida };

export type TipoInstitucion = "sena" | "universitaria" | "desconocida";

export type ResultadoExtraccion = {
  unidades: MateriaExtraida[];
  tipoInstitucion: TipoInstitucion;
  metodo: string;
};

export interface Extractor {
  readonly nombre: string;
  extraer(texto: string, bytes?: Uint8Array): Promise<MateriaExtraida[]>;
}

// ── Normalización ──
//
// Cada unidad extraída (materia, competencia, etc.) se convierte a un formato
// uniforme independiente de la institución de origen. La normalización produce
// cuatro campos: nombre (limpio), descripcion (enriquecida para matching IA),
// componentes (sub-items: RAs, temas, unidades), y los metadatos originales.

export type UnidadAcademicaNormalizada = {
  /** Nombre limpio de la unidad (materia, competencia). */
  nombre: string;
  /** Descripción enriquecida que alimenta al motor de matching IA. Incluye el
   *  nombre y, si existen, los componentes (RAs, temas, etc.). */
  descripcion: string;
  /** Componentes o sub-items: resultados de aprendizaje para SENA, temas o
   *  unidades para materias universitarias. Es la lista estructurada, no va
   *  duplicada en metadatos. */
  componentes: string[];
  /** Texto consolidado para embeddings y búsqueda vectorial futura. Se construye
   *  concatenando nombre + descripción + componentes. No se genera embedding
   *  todavía, solo se prepara el texto. */
  textoEmbedding: string;
  creditos: number | null;
  /** Horas originales del SENA. Los créditos son una conversión aproximada (round(IH / 48)). */
  intensidadHoraria: number | null;
  nota: string | null;
  semestre: number | null;
  tipo: string;
  /** Solo información sin esquema definido. Los componentes NO van aquí. */
  metadatos: Record<string, unknown> | null;
};

export type ResultadoNormalizado = {
  unidades: UnidadAcademicaNormalizada[];
  tipoInstitucion: TipoInstitucion;
  metodo: string;
};
