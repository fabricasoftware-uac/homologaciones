import { SenaParser } from "./sena-parser";
import { ParserIA } from "./ia-parser";
import { normalizar } from "./normalizador";
import type {
  MateriaExtraida,
  UnidadAcademicaNormalizada,
  TipoInstitucion,
  ResultadoExtraccion,
  ResultadoNormalizado,
  Extractor,
} from "./tipos";

export type {
  MateriaExtraida,
  UnidadAcademicaNormalizada,
  TipoInstitucion,
  ResultadoExtraccion,
  ResultadoNormalizado,
};

const parserSena = new SenaParser();
const parserIA = new ParserIA();

function detectarInstitucion(institucionOrigen: string): TipoInstitucion {
  if (/sena/i.test(institucionOrigen)) return "sena";
  return "universitaria";
}

function seleccionarExtractor(tipo: TipoInstitucion): Extractor {
  return tipo === "sena" ? parserSena : parserIA;
}

export async function extraerUnidadesAcademicas(
  textoPdf: string,
  institucionOrigen: string,
  bytesPdf?: Uint8Array,
): Promise<ResultadoExtraccion> {
  const tipoInstitucion = detectarInstitucion(institucionOrigen);
  const extractor = seleccionarExtractor(tipoInstitucion);

  console.log(
    `[extraccion] Institución: ${institucionOrigen} → tipo: ${tipoInstitucion} → extractor: ${extractor.nombre}`,
  );

  const unidades = await extractor.extraer(textoPdf, bytesPdf);

  return { unidades, tipoInstitucion, metodo: extractor.nombre };
}

// Extrae y normaliza: el resultado usa UnidadAcademicaNormalizada con estructura uniforme.
// Esta es la función que debe usar el pipeline de homologación.
export async function extraerYNormalizar(
  textoPdf: string,
  institucionOrigen: string,
  bytesPdf?: Uint8Array,
): Promise<ResultadoNormalizado> {
  const crudo = await extraerUnidadesAcademicas(textoPdf, institucionOrigen, bytesPdf);
  const normalizadas = normalizar(crudo.unidades);

  console.log(
    `[extraccion] Normalizadas ${normalizadas.length} unidades académicas (${crudo.metodo}).`,
  );

  return { unidades: normalizadas, tipoInstitucion: crudo.tipoInstitucion, metodo: crudo.metodo };
}
