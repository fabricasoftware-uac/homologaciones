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
