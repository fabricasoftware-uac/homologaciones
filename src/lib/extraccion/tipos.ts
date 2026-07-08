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
  nombre: string;
  descripcion: string;
  componentes: string[];
  textoEmbedding: string;
  creditos: number | null;
  /** Horas originales del SENA. Los créditos son una conversión aproximada (round(IH / 48)). */
  intensidadHoraria: number | null;
  nota: string | null;
  semestre: number | null;
  tipo: string;
  metadatos: Record<string, unknown> | null;
};

export type ResultadoNormalizado = {
  unidades: UnidadAcademicaNormalizada[];
  tipoInstitucion: TipoInstitucion;
  metodo: string;
};
