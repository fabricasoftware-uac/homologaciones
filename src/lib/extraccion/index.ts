import { SenaParser } from "./sena-parser";
import { SeguimientoPensumParser } from "./seguimiento-pensum-parser";
import { ParserIA } from "./ia-parser";
import { normalizar } from "./normalizador";
import { evaluarCalidadTexto } from "./calidad";
import { filtrarHomologables } from "./notas";
import { NOTA_MINIMA_APROBACION } from "./escala-nota";
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
const parserSeguimiento = new SeguimientoPensumParser();
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

// Rescate con IA del camino SENA. Devuelve null si la IA no está disponible (sin créditos, sin key,
// todos los modelos caídos): el llamador decide si eso basta para descartar lo que ya tenía. Sin
// este catch, un fallo del proveedor tumbaba el caso entero aunque el parser determinístico hubiera
// leído casi todo.
async function rescatarConIA(
  textoPdf: string,
  bytesPdf?: Uint8Array,
): Promise<{ unidades: MateriaExtraida[]; tipoReal: TipoInstitucion } | null> {
  try {
    return sanearRescateSena(await parserIA.extraer(textoPdf, bytesPdf));
  } catch (e) {
    console.warn("[extraccion] El rescate con ParserIA no se pudo completar:", e);
    return null;
  }
}

export type OpcionesExtraccion = {
  /** Mínimo para dar una materia por ganada (`configuracion.nota_minima`). Solo aplica al camino
   *  universitario: lo que no se ganó no se puede homologar. */
  notaMinima?: number;
};

export async function extraerUnidadesAcademicas(
  textoPdf: string,
  institucionOrigen: string,
  bytesPdf?: Uint8Array,
  opciones?: OpcionesExtraccion,
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

    const diag = await parserSena.extraerConDiagnostico(textoPdf, bytesPdf);

    // La condición de salud es `fallidas === 0`, NO que el total cuadre con `esperadas`: fusionar
    // una competencia partida por un salto de página baja el total A PROPÓSITO. Lo que no se tolera
    // es una fila que el parser no supo leer.
    if (diag.unidades.length > 0 && diag.fallidas === 0) {
      return { unidades: diag.unidades, tipoInstitucion, metodo: parserSena.nombre };
    }

    // Antes el rescate solo se disparaba con CERO competencias, así que una extracción parcial
    // (19 de 20) pasaba como buena y el caso seguía adelante con horas de menos, sin que nadie se
    // enterara. Ahora cualquier fila ilegible dispara el rescate.
    const motivo =
      diag.unidades.length === 0
        ? "no encontró competencias (¿el formato cambió, o no es un documento SENA?)"
        : `leyó ${diag.unidades.length} competencias pero ${diag.fallidas} fila(s) de ${diag.esperadas} quedaron ilegibles`;
    console.warn(`[extraccion] SenaParser ${motivo}; se intenta el rescate con ParserIA.`);

    const rescate = await rescatarConIA(textoPdf, bytesPdf);

    // El rescate con IA solo gana si trae MÁS unidades que el parser determinístico. Si trae menos
    // (o falla por completo, p. ej. sin créditos de OpenRouter), quedarse con lo determinístico es
    // estrictamente mejor que tirar 19 competencias correctas por 1 ilegible.
    if (!rescate || rescate.unidades.length <= diag.unidades.length) {
      if (diag.unidades.length === 0) {
        return {
          unidades: rescate?.unidades ?? [],
          tipoInstitucion: rescate?.tipoReal ?? tipoInstitucion,
          metodo: `${parserSena.nombre}→${parserIA.nombre}`,
        };
      }
      console.warn(
        `[extraccion] El rescate con IA no mejoró (${rescate?.unidades.length ?? 0} unidades); se conserva la extracción determinística.`,
      );
      return {
        unidades: diag.unidades,
        tipoInstitucion,
        metodo: `${parserSena.nombre} (parcial: ${diag.fallidas}/${diag.esperadas} ilegibles)`,
      };
    }

    return {
      unidades: rescate.unidades,
      tipoInstitucion: rescate.tipoReal,
      metodo: `${parserSena.nombre}→${parserIA.nombre}`,
    };
  }

  // Camino UNIVERSITARIO. Antes de gastar un token: el reporte "SEGUIMIENTO PENSUM GENERAL POR
  // ESTUDIANTE" (el formato más frecuente en el panel después del SENA) se lee entero por
  // coordenadas, sin IA, y devuelve SOLO lo que el estudiante cursó, con su nota.
  const notaMinima = opciones?.notaMinima ?? NOTA_MINIMA_APROBACION;
  const seguimiento = await parserSeguimiento.extraerConDiagnostico(textoPdf, bytesPdf);
  if (seguimiento.detectado) {
    if (seguimiento.unidades.length > 0) {
      return {
        unidades: filtrarHomologables(seguimiento.unidades, notaMinima),
        tipoInstitucion,
        metodo: parserSeguimiento.nombre,
      };
    }

    // Formato reconocido y sin materias: si tampoco hay filas cursadas, el reporte dice la verdad
    // —el estudiante no ha cursado nada— y el caso queda vacío a propósito. Mandarlo al ParserIA
    // solo traería de vuelta el plan completo sin notas, que es justo lo que no queremos.
    if (seguimiento.cursadas === 0) {
      console.warn(
        `[extraccion] SeguimientoPensumParser: el reporte lista ${seguimiento.filas} fila(s) del plan y ninguna cursada; el caso queda sin materias de origen.`,
      );
      return { unidades: [], tipoInstitucion, metodo: parserSeguimiento.nombre };
    }

    // Hay filas cursadas pero no se les pudo leer la nota: eso NO es un documento vacío, es una
    // lectura rota (¿cambió el formato?). Se cae al ParserIA en vez de tragarse la pérdida.
    console.warn(
      `[extraccion] SeguimientoPensumParser: ${seguimiento.cursadas} fila(s) cursadas y ninguna nota legible; se intenta con ParserIA.`,
    );
  }

  const unidades = filtrarHomologables(await extractor.extraer(textoPdf, bytesPdf), notaMinima);
  return {
    unidades,
    tipoInstitucion,
    metodo: seguimiento.detectado ? `${parserSeguimiento.nombre}→${extractor.nombre}` : extractor.nombre,
  };
}

// Extrae y normaliza: el resultado usa UnidadAcademicaNormalizada con estructura uniforme.
// Esta es la función que debe usar el pipeline de homologación.
export async function extraerYNormalizar(
  textoPdf: string,
  institucionOrigen: string,
  bytesPdf?: Uint8Array,
  opciones?: OpcionesExtraccion,
): Promise<ResultadoNormalizado> {
  const crudo = await extraerUnidadesAcademicas(textoPdf, institucionOrigen, bytesPdf, opciones);
  const normalizadas = normalizar(crudo.unidades);

  console.log(
    `[extraccion] Normalizadas ${normalizadas.length} unidades académicas (${crudo.metodo}).`,
  );

  return { unidades: normalizadas, tipoInstitucion: crudo.tipoInstitucion, metodo: crudo.metodo };
}
