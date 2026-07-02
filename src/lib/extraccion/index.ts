import { SenaParser } from "./sena-parser";
import { ParserIA } from "./ia-parser";
import type { MateriaExtraida, TipoInstitucion, ResultadoExtraccion, Extractor } from "./tipos";

export type { MateriaExtraida, TipoInstitucion, ResultadoExtraccion };

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

  return {
    unidades,
    tipoInstitucion,
    metodo: extractor.nombre,
  };
}
