import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { llamarGroq, llamarGroqVision } from "./cliente";

// Extracción del PLAN DE ESTUDIOS (pensum) de una carrera. Dos caminos:
//   - extraerAsignaturasDePensum(texto): para PDFs con capa de texto (lo normal).
//   - extraerAsignaturasPorVision(bytes): para PDFs ESCANEADOS (sin texto): renderiza las páginas a
//     imagen y se las pasa a un modelo de visión, que las "lee" como si fuera OCR.
// Ambos producen la misma estructura y comparten el parseo/saneado.

export type AsignaturaExtraida = {
  nombre: string;
  codigo: string | null;
  creditos: number; // la tabla exige no-null y >= 0; si no aparece, 0
  semestre: number; // la tabla exige > 0; descartamos las que no lo tengan claro
};

const FORMA =
  'Responde ÚNICAMENTE un objeto JSON: {"asignaturas": [{"nombre": "...", "codigo": null, "creditos": 3, "semestre": 1}]}';

const SISTEMA = `Eres un extractor de planes de estudio (pensum) universitarios. Recibes el TEXTO de un PDF con el plan de estudios de una carrera, donde las asignaturas vienen organizadas por SEMESTRE (o nivel/periodo) con sus créditos.

Extrae TODAS las asignaturas del plan. Para cada una: nombre (obligatorio), codigo (institucional si aparece; si no, null), creditos (entero; si no aparece, 0), semestre (número del semestre al que pertenece, OBLIGATORIO).

No inventes asignaturas. Ignora encabezados, totales, créditos totales y notas al pie. ${FORMA}`;

const SISTEMA_VISION = `Eres un extractor de planes de estudio (pensum) universitarios. Recibes una o varias IMÁGENES de las páginas de un PDF con el plan de estudios de una carrera, donde las asignaturas vienen organizadas por SEMESTRE con sus créditos.

Lee las imágenes y extrae TODAS las asignaturas del plan. Para cada una: nombre (obligatorio), codigo (si aparece; si no, null), creditos (entero; si no aparece, 0), semestre (número, OBLIGATORIO).

No inventes asignaturas. Ignora encabezados, totales y notas al pie. ${FORMA}`;

// Cuántas páginas recorremos por visión. Va UNA página por request (el modelo admite máx 3 imágenes y
// varias páginas grandes juntas exceden el límite de tokens/min), así que esto no es imágenes-por-
// llamada sino páginas totales. 8 cubre de sobra un plan de estudios.
const MAX_PAGINAS_VISION = 8;

function aEnteroPositivoONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function aCreditos(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function aTextoONull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

// Parseo y saneado compartido por ambos caminos (texto y visión).
function parsearAsignaturas(contenido: string | null): AsignaturaExtraida[] {
  if (!contenido) return [];
  try {
    const parsed = JSON.parse(contenido) as { asignaturas?: unknown[] };
    const lista = Array.isArray(parsed.asignaturas) ? parsed.asignaturas : [];
    return lista
      .map((cruda): AsignaturaExtraida | null => {
        const a = cruda as Record<string, unknown>;
        const nombre = aTextoONull(a.nombre);
        const semestre = aEnteroPositivoONull(a.semestre);
        if (!nombre || semestre === null) return null; // la tabla exige semestre > 0
        return { nombre, codigo: aTextoONull(a.codigo), creditos: aCreditos(a.creditos), semestre };
      })
      .filter((a): a is AsignaturaExtraida => a !== null);
  } catch {
    console.error("[groq] Extracción de pensum: la respuesta no era JSON válido:", contenido);
    return [];
  }
}

// Camino normal: PDF con texto.
export async function extraerAsignaturasDePensum(texto: string): Promise<AsignaturaExtraida[]> {
  const recorte = texto.slice(0, 12000); // un plan completo cabe de sobra; margen para el TPM del tier
  const contenido = await llamarGroq(
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: recorte },
    ],
    { json: true },
  );
  return parsearAsignaturas(contenido);
}

// Quita asignaturas repetidas (mismo nombre + semestre), por si dos páginas solapan contenido.
function dedupeAsignaturas(lista: AsignaturaExtraida[]): AsignaturaExtraida[] {
  const vistas = new Set<string>();
  return lista.filter((a) => {
    const clave = `${a.nombre.toLowerCase().trim()}|${a.semestre}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

// Camino para PDFs escaneados (sin texto): renderiza cada página a imagen y la lee por visión. Va UNA
// página por llamada —el modelo admite máx 3 imágenes y varias páginas grandes juntas exceden el
// límite de tokens/min (413)— y fusiona lo de todas.
export async function extraerAsignaturasPorVision(bytes: Uint8Array): Promise<AsignaturaExtraida[]> {
  // numPages desde una COPIA (las operaciones de pdf.js pueden "consumir"/desligar el buffer).
  const pdf = await getDocumentProxy(bytes.slice());
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_VISION);

  const asignaturas: AsignaturaExtraida[] = [];
  for (let i = 1; i <= paginas; i++) {
    // Importante: a renderPageAsImage se le pasan los BYTES (no el proxy) para que unpdf configure el
    // canvas de Node; y una copia por página para no usar un buffer ya consumido.
    const url = await renderPageAsImage(bytes.slice(), i, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 1.5, // suficiente para OCR y consume MENOS tokens que scale 2 (menos riesgo de 429)
      toDataURL: true,
    });
    if (typeof url !== "string") continue;

    // Round-robin de modelos por página: reparte el gasto de tokens entre los cupos de cada modelo.
    const contenido = await llamarGroqVision(SISTEMA_VISION, [url], i - 1);
    if (contenido === null) continue; // esta página falló: seguimos con las demás (best-effort)
    asignaturas.push(...parsearAsignaturas(contenido));
  }
  return dedupeAsignaturas(asignaturas);
}
