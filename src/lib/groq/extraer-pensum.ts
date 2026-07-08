import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { llamarGroq, llamarGroqVision } from "./cliente";
import { llamarGemini, llamarGeminiVision } from "@/lib/gemini/cliente";

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

const SISTEMA = `Eres un extractor de planes de estudio (pensum) universitarios. Recibes el TEXTO de un PDF con el plan de estudios de una carrera, reconstruido en orden visual: los campos de un mismo renglón van separados por " | " y puede venir dividido en secciones "--- COLUMNA N ---" o "--- PÁGINA N ---".

Cómo leer el semestre de cada asignatura:
- Si hay un encabezado explícito ("Semestre III", "Nivel 2", "Periodo 4", o números romanos), úsalo para todas las asignaturas de ese bloque.
- En planes en cuadrícula, cada bloque que empieza con "Materia | Créditos" (o similar) es UN semestre, y su número suele aparecer como un dígito suelto (1-12) justo antes, dentro o después del bloque.
- Los planes suelen tener entre 8 y 12 semestres: recorre TODO el texto hasta el final y no te detengas en los primeros bloques.

Extrae TODAS las asignaturas del plan. Para cada una: nombre (obligatorio; si el nombre quedó partido en dos renglones, únelo), codigo (institucional si aparece; si no, null), creditos (entero; si no aparece, 0), semestre (número del semestre al que pertenece, OBLIGATORIO).

No inventes asignaturas. Ignora encabezados, filas de "Total", créditos totales del programa y notas al pie. ${FORMA}`;

const SISTEMA_VISION = `Eres un extractor de planes de estudio (pensum) universitarios. Recibes una o varias IMÁGENES de las páginas de un PDF con el plan de estudios de una carrera, donde las asignaturas vienen organizadas por SEMESTRE con sus créditos.

Lee las imágenes y extrae TODAS las asignaturas del plan. Para cada una: nombre (obligatorio), codigo (si aparece; si no, null), creditos (entero; si no aparece, 0), semestre (número, OBLIGATORIO).

No inventes asignaturas. Ignora encabezados, totales y notas al pie. ${FORMA}`;

// Cuántas páginas recorremos por visión. Va UNA página por request (el modelo admite máx 3 imágenes y
// varias páginas grandes juntas exceden el límite de tokens/min), así que esto no es imágenes-por-
// llamada sino páginas totales. 20 = paridad con la extracción de certificados.
const MAX_PAGINAS_VISION = 20;

// Tamaño máximo de cada trozo de texto que se envía a la IA. Un plan grande se trocea por secciones
// (columnas/páginas del texto estructurado) y se hace una llamada por trozo; los resultados se
// fusionan y deduplican. Así ningún semestre queda fuera por truncamiento.
const LIMITE_TROZO = 10000;

// Tokens de salida explícitos: sin esto algunos modelos truncan la lista JSON de un plan grande.
const MAX_TOKENS_SALIDA = 8192;

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

// Divide el texto en trozos de máximo LIMITE_TROZO caracteres, cortando por los separadores de
// sección del texto estructurado ("--- COLUMNA/PÁGINA N ---") para no partir un semestre por la
// mitad. Si una sección sola excede el límite, se parte por saltos de línea.
function trocearTexto(texto: string): string[] {
  if (texto.length <= LIMITE_TROZO) return [texto];

  const secciones = texto.split(/\n\n(?=--- )/);
  const trozos: string[] = [];
  let actual = "";
  for (const seccion of secciones) {
    const bloques = seccion.length > LIMITE_TROZO ? partirPorLineas(seccion) : [seccion];
    for (const bloque of bloques) {
      if (actual && actual.length + bloque.length + 2 > LIMITE_TROZO) {
        trozos.push(actual);
        actual = "";
      }
      actual = actual ? `${actual}\n\n${bloque}` : bloque;
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}

function partirPorLineas(seccion: string): string[] {
  const partes: string[] = [];
  const lineas = seccion.split("\n");
  let actual = "";
  for (const linea of lineas) {
    if (actual && actual.length + linea.length + 1 > LIMITE_TROZO) {
      partes.push(actual);
      actual = "";
    }
    actual = actual ? `${actual}\n${linea}` : linea;
  }
  if (actual) partes.push(actual);
  return partes;
}

async function extraerDeTrozo(trozo: string): Promise<AsignaturaExtraida[]> {
  const mensajes = [
    { role: "system" as const, content: SISTEMA },
    { role: "user" as const, content: trozo },
  ];
  const contenido =
    (await llamarGroq(mensajes, { json: true, maxTokens: MAX_TOKENS_SALIDA })) ??
    (await llamarGemini(mensajes, { json: true, maxTokens: MAX_TOKENS_SALIDA }));
  return parsearAsignaturas(contenido);
}

// Camino normal: PDF con texto. Trocea el texto (sin truncarlo), extrae cada trozo por separado y
// fusiona los resultados. Antes se recortaba a 12k chars y los semestres finales de planes grandes
// nunca llegaban al modelo.
export async function extraerAsignaturasDePensum(texto: string): Promise<AsignaturaExtraida[]> {
  const trozos = trocearTexto(texto);
  const asignaturas: AsignaturaExtraida[] = [];
  for (const [i, trozo] of trozos.entries()) {
    const parciales = await extraerDeTrozo(trozo);
    if (trozos.length > 1) {
      console.log(`[pensum] trozo ${i + 1}/${trozos.length}: ${parciales.length} asignaturas`);
    }
    asignaturas.push(...parciales);
  }
  return dedupeAsignaturas(asignaturas);
}

// Clave de comparación tolerante: minúsculas, sin tildes, espacios colapsados. El rango va con
// escapes \u (los diacríticos combinantes literales corrompen archivos, ya nos pasó).
function claveNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ")
    .trim();
}

// Quita asignaturas repetidas (mismo nombre + semestre), por si dos trozos/páginas solapan contenido.
function dedupeAsignaturas(lista: AsignaturaExtraida[]): AsignaturaExtraida[] {
  const vistas = new Set<string>();
  return lista.filter((a) => {
    const clave = `${claveNombre(a.nombre)}|${a.semestre}`;
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
    const contenido =
      (await llamarGroqVision(SISTEMA_VISION, [url], i - 1)) ??
      (await llamarGeminiVision(SISTEMA_VISION, [url], i - 1));
    if (contenido === null) continue; // esta página falló: seguimos con las demás (best-effort)
    asignaturas.push(...parsearAsignaturas(contenido));
  }
  return dedupeAsignaturas(asignaturas);
}
