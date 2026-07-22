import { SenaParser } from "./sena-parser";
import { ParserIA } from "./ia-parser";
import { normalizar } from "./normalizador";
import { evaluarCalidadTexto } from "./calidad";
import { extraerMateriasPorVision } from "@/lib/ia/extraer-materias";
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

export function detectarInstitucion(institucionOrigen: string): TipoInstitucion {
  if (/sena/i.test(institucionOrigen)) return "sena";
  return "universitaria";
}

// Saneo del RESCATE del camino SENA (cuando el SenaParser no encontró competencias y extrajo el
// ParserIA genérico). Antes se forzaba tipo="competencia" a ciegas y, si el documento en realidad
// era un certificado UNIVERSITARIO con la institución mal escrita (decía "SENA"), el normalizador
// trataba los créditos como horas (÷48: 3 créditos → 1) y borraba los semestres. Si los números
// parecen créditos universitarios (chicos), el documento ES universitario; las competencias SENA
// van en horas (48+).
function sanearRescateSena(unidades: MateriaExtraida[]): {
  unidades: MateriaExtraida[];
  tipoReal: TipoInstitucion;
} {
  const maxCreditos = Math.max(0, ...unidades.map((u) => u.creditos ?? 0));
  if (unidades.length > 0 && maxCreditos > 0 && maxCreditos <= 15) {
    console.warn(
      "[extraccion] La institución decía SENA pero el documento trae créditos universitarios; se trata como universitario.",
    );
    return { unidades, tipoReal: "universitaria" };
  }
  // Sí parece SENA: competencias sin semestre (si el modelo inventó uno, se descarta; con semestre
  // las tarjetas de origen aparecen repartidas en "Semestre 1/2/3..." sin sentido).
  return {
    unidades: unidades.map((u) => ({ ...u, tipo: "competencia", semestre_origen: null })),
    tipoReal: "sena",
  };
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
      // El parseo genérico de visión marca tipo "materia": el saneo decide si de verdad es SENA
      // (competencias en horas) o un certificado universitario mal etiquetado como SENA.
      const crudas = await extraerMateriasPorVision(bytesPdf, true);
      const { unidades, tipoReal } = sanearRescateSena(crudas);
      return { unidades, tipoInstitucion: tipoReal, metodo: "VisionSENA" };
    }

    const unidades = await parserSena.extraer(textoPdf);
    if (unidades.length > 0) {
      return { unidades, tipoInstitucion, metodo: parserSena.nombre };
    }

    console.warn(
      "[extraccion] SenaParser no encontró competencias (¿el formato cambió, o no es un documento SENA?); fallback a ParserIA.",
    );
    const rescate = sanearRescateSena(await parserIA.extraer(textoPdf, bytesPdf));
    return {
      unidades: rescate.unidades,
      tipoInstitucion: rescate.tipoReal,
      metodo: `${parserSena.nombre}→${parserIA.nombre}`,
    };
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
