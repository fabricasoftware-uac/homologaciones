import { SenaParser } from "./sena-parser";
import { ParserIA } from "./ia-parser";
import { normalizar } from "./normalizador";
import { evaluarCalidadTexto } from "./calidad";
import { extraerMateriasPorVision } from "@/lib/groq/extraer-materias";
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

  // Camino SENA con RED DE SEGURIDAD: el regex es un punto único de falla (si el SENA cambia el
  // formato, devolvería 0 competencias EN SILENCIO y el caso quedaría vacío). Por eso: (a) si el
  // texto no es usable (escaneado/corrupto) vamos directo a visión con el prompt SENA; (b) si el
  // parser determinístico no encuentra nada, caemos al ParserIA en vez de aceptar el vacío.
  if (tipoInstitucion === "sena") {
    const calidad = evaluarCalidadTexto(textoPdf);

    if (!calidad.usable && bytesPdf) {
      console.warn(`[extraccion] SENA con texto no usable (${calidad.motivo}) → visión SENA (OCR).`);
      // El parseo genérico de visión marca tipo "materia": lo corregimos a "competencia" para que
      // el normalizador aplique la lógica SENA (nombre limpio, horas → créditos, RAs).
      const unidades = (await extraerMateriasPorVision(bytesPdf, true)).map((u) => ({
        ...u,
        tipo: "competencia",
      }));
      return { unidades, tipoInstitucion, metodo: "VisionSENA" };
    }

    const unidades = await parserSena.extraer(textoPdf);
    if (unidades.length > 0) {
      return { unidades, tipoInstitucion, metodo: parserSena.nombre };
    }

    console.warn(
      "[extraccion] SenaParser no encontró competencias (¿cambió el formato del SENA?); fallback a ParserIA.",
    );
    const rescatadas = await parserIA.extraer(textoPdf, bytesPdf);
    return { unidades: rescatadas, tipoInstitucion, metodo: `${parserSena.nombre}→${parserIA.nombre}` };
  }

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
