import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { llamarGroq, llamarGroqVision, ErrorIANoDisponible } from "./cliente";
import { llamarGemini, llamarGeminiVision } from "@/lib/gemini/cliente";

// Fase 4 · Extracción de materias del PDF. Dos caminos, igual que la extracción del pensum:
//   - extraerMateriasDeTexto(texto): certificados con capa de texto (lo normal).
//   - extraerMateriasPorVision(bytes): certificados ESCANEADOS (sin texto): renderiza las páginas a
//     imagen y se las pasa a un modelo de visión, que las "lee" como si fuera OCR.
// Ambos comparten el parseo/saneado. Le pedimos a Groq una lista estructurada de materias y
// sanitizamos cada campo: la IA puede devolver números como texto, campos faltantes, etc.

export type MateriaExtraida = {
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  nota: string | null;
  semestre_origen: number | null;
};

const SISTEMA = `Eres un extractor de datos académicos. Recibes el TEXTO de un certificado de notas o historial académico universitario, donde las materias suelen venir agrupadas por semestre o periodo académico.

Extrae TODAS las materias que cursó el estudiante y ORGANÍZALAS POR SEMESTRE. Para cada materia incluye:
- nombre: el nombre de la materia (obligatorio).
- codigo: el código institucional si aparece; si no, null.
- creditos: número de créditos si aparece; si no, null.
- nota: la calificación tal como aparece (texto); si no, null.
- semestre_origen: el número de semestre al que pertenece (1, 2, 3, ...).

Reglas para semestre_origen:
- Si el documento agrupa por semestre o periodo (p. ej. "Semestre 1", "Periodo 2019-1", "2019-2"), asigna a cada materia el número de semestre que le corresponde, numerando los periodos en orden cronológico como 1, 2, 3, ...
- Si no hay una separación explícita, infiérelo por el orden y el nivel de las materias.
- Usa null SOLO si es imposible determinarlo.

No inventes materias que no estén en el texto. Ignora encabezados, totales y promedios.
Devuelve las materias ORDENADAS por semestre. Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "...", "codigo": null, "creditos": null, "nota": null, "semestre_origen": 1}]}`;

// Variante SENA para certificados escaneados (visión/OCR).
const SISTEMA_VISION_SENA = `Eres un extractor de datos académicos especializado en certificados del SENA (Servicio Nacional de Aprendizaje) de Colombia. Recibes IMÁGENES de las páginas de una constancia de notas de formación titulada, donde los contenidos NO son materias tradicionales sino COMPETENCIAS con RESULTADOS DE APRENDIZAJE.

Lee las imágenes y extrae CADA COMPETENCIA como una materia. Para cada una:
- nombre: el nombre de la competencia LIMPIO (sin los resultados de aprendizaje). Normaliza mayúsculas a oración.
- codigo: null.
- creditos: el número de horas (IH) de la competencia como entero.
- nota: "Aprobado" si la evaluación es "A"; si es "D", "No aprobado".
- semestre_origen: null (el SENA no tiene semestres).

No inventes competencias. Ignora encabezados y firma.
Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "...", "codigo": null, "creditos": 48, "nota": "Aprobado", "semestre_origen": null}]}`;

// Variante para certificados ESCANEADOS: en vez de texto recibe imágenes de las páginas y las "lee".
const SISTEMA_VISION = `Eres un extractor de datos académicos. Recibes una o varias IMÁGENES de las páginas de un certificado de notas o historial académico universitario, donde las materias suelen venir agrupadas por semestre o periodo académico.

Lee las imágenes y extrae TODAS las materias que cursó el estudiante, ORGANIZADAS POR SEMESTRE. Para cada materia incluye:
- nombre: el nombre de la materia (obligatorio).
- codigo: el código institucional si aparece; si no, null.
- creditos: número de créditos si aparece; si no, null.
- nota: la calificación tal como aparece (texto); si no, null.
- semestre_origen: el número de semestre al que pertenece (1, 2, 3, ...); numera los periodos en orden cronológico. Usa null solo si es imposible determinarlo.

No inventes materias que no aparezcan en las imágenes. Ignora encabezados, totales y promedios.
Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "...", "codigo": null, "creditos": null, "nota": null, "semestre_origen": 1}]}`;

// Tope de páginas a leer por visión. Procesamos UNA por request (el modelo admite máx 3 imágenes y
// varias páginas grandes juntas revientan el límite de tokens/min), así que este número es cuántas
// páginas recorremos, no cuántas van por llamada. 8 cubre de sobra un historial académico completo.
const MAX_PAGINAS_VISION = 8;

function aNumeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// creditos y semestre_origen son columnas smallint: solo aceptan enteros. Un valor decimal
// (típico cuando la IA mete una nota "4.5" en el campo de créditos) rompería el INSERT con
// "invalid input syntax for type smallint", así que lo descartamos (null) en vez de reventar el
// pipeline entero y dejar el caso atascado en 'procesando'. Un "3.0" sigue valiendo (es entero).
function aEnteroONull(valor: unknown): number | null {
  const n = aNumeroONull(valor);
  return n !== null && Number.isInteger(n) ? n : null;
}

function aTextoONull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

// Parseo y saneado compartido por ambos caminos (texto y visión).
function parsearMaterias(contenido: string | null): MateriaExtraida[] {
  if (!contenido) return [];
  try {
    const parsed = JSON.parse(contenido) as { materias?: unknown[] };
    const lista = Array.isArray(parsed.materias) ? parsed.materias : [];
    return lista
      .map((cruda): MateriaExtraida | null => {
        const m = cruda as Record<string, unknown>;
        const nombre = aTextoONull(m.nombre);
        if (!nombre) return null; // sin nombre no sirve
        return {
          nombre,
          codigo: aTextoONull(m.codigo),
          creditos: aEnteroONull(m.creditos),
          nota: aTextoONull(m.nota),
          semestre_origen: aEnteroONull(m.semestre_origen),
        };
      })
      .filter((m): m is MateriaExtraida => m !== null);
  } catch {
    console.error("[groq] Extracción de materias: la respuesta no era JSON válido:", contenido);
    return [];
  }
}

// Documento del SENA (Servicio Nacional de Aprendizaje): en vez de materias organizadas por semestre,
// el SENA estructura su formación por COMPETENCIAS, cada una con RESULTADOS DE APRENDIZAJE e
// INTENSIDAD HORARIA (IH). La evaluación es cualitativa (A = Aprobado). No hay semestres.
// Detectamos por frases clave del membrete y la columna "REGISTRO DE COMPETENCIAS EVALUADAS".
function esDocumentoSENA(texto: string): boolean {
  return /SERVICIO NACIONAL DE APRENDIZAJE|REGISTRO DE COMPETENCIAS EVALUADAS/i.test(texto);
}

const SISTEMA_SENA = `Eres un extractor de datos académicos especializado en certificados del SENA (Servicio Nacional de Aprendizaje) de Colombia. Recibes el TEXTO de una constancia de notas de formación titulada, donde los contenidos NO son materias tradicionales sino COMPETENCIAS con RESULTADOS DE APRENDIZAJE.

Formato típico SENA: cada bloque contiene:
- Nombre de la COMPETENCIA (en mayúsculas o mixto, puede ocupar varias líneas).
- Una línea con la nota numérica (ej. "4,5"), evaluación cualitativa ("A" = Aprobado), "REGISTRO DE COMPETENCIAS EVALUADAS", "EVAL", "IH" y un número (horas).
- "RESULTADOS DE APRENDIZAJE" seguido de items numerados (01, 02, 03...) que describen lo que el estudiante aprendió.

Extrae CADA COMPETENCIA como una materia. Para cada una:
- nombre: el nombre de la competencia LIMPIO (sin los resultados de aprendizaje, sin las notas, sin "REGISTRO DE COMPETENCIAS..."). Normaliza mayúsculas a oración (primera letra mayúscula, resto minúscula) para facilitar el emparejamiento posterior.
- codigo: null (el SENA no usa códigos de materia).
- creditos: el número de horas (IH) de la competencia como entero (48, 144, etc.).
- nota: "Aprobado" si la evaluación es "A"; si es "D", "No aprobado".
- semestre_origen: null (el SENA no tiene semestres).

No inventes competencias. Ignora encabezados, el membrete institucional y la firma final.
Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "...", "codigo": null, "creditos": 48, "nota": "Aprobado", "semestre_origen": null}]}`;

function parsearCompetenciasSENA(contenido: string | null): MateriaExtraida[] {
  return parsearMaterias(contenido);
}

// Camino normal: certificado con capa de texto.
export async function extraerMateriasDeTexto(texto: string): Promise<MateriaExtraida[]> {
  const recorte = texto.slice(0, 12000); // suficiente para un historial completo; controla tokens

  const esSena = esDocumentoSENA(recorte);
  const sistemaPrompt = esSena ? SISTEMA_SENA : SISTEMA;

  const contenido =
    (await llamarGroq(
      [
        { role: "system", content: sistemaPrompt },
        { role: "user", content: recorte },
      ],
      { json: true },
    )) ??
    (await llamarGemini(
      [
        { role: "system", content: sistemaPrompt },
        { role: "user", content: recorte },
      ],
      { json: true },
    ));

  if (contenido === null) {
    throw new ErrorIANoDisponible("No se pudieron extraer las materias del certificado (texto).");
  }

  if (esSena) {
    return parsearCompetenciasSENA(contenido);
  }
  return parsearMaterias(contenido);
}

// Quita materias repetidas (misma por nombre), por si dos páginas solapan contenido.
function dedupePorNombre(lista: MateriaExtraida[]): MateriaExtraida[] {
  const vistas = new Set<string>();
  return lista.filter((m) => {
    const clave = m.nombre.toLowerCase().trim();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

// Camino para certificados ESCANEADOS (sin texto): renderiza cada página a imagen y la lee por visión
// (OCR). Va UNA página por llamada —el modelo admite máx 3 imágenes y varias páginas grandes juntas
// exceden el límite de tokens/min (413)— y fusiona lo de todas. Espejo de extraerAsignaturasPorVision.
export async function extraerMateriasPorVision(bytes: Uint8Array): Promise<MateriaExtraida[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_VISION);

  const materias: MateriaExtraida[] = [];
  let huboFallo = false;
  let esSena = false;
  let primerTexto = "";

  for (let i = 1; i <= paginas; i++) {
    const url = await renderPageAsImage(bytes.slice(), i, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 1.5,
      toDataURL: true,
    });
    if (typeof url !== "string") continue;

    const promptFinal =
      esSena ? SISTEMA_VISION_SENA : SISTEMA_VISION;

    const contenido =
      (await llamarGroqVision(promptFinal, [url], i - 1)) ??
      (await llamarGeminiVision(promptFinal, [url], i - 1));

    if (contenido === null) {
      huboFallo = true;
      continue;
    }

    const extraidas = parsearMaterias(contenido);
    materias.push(...extraidas);

    if (i === 1 && !esSena) {
      primerTexto = extraidas.map((m) => m.nombre).join(" ");
      esSena = esDocumentoSENA(primerTexto);
    }
  }

  if (materias.length === 0 && huboFallo) {
    throw new ErrorIANoDisponible("No se pudo leer el certificado escaneado (posible falta de cupo).");
  }
  return dedupePorNombre(materias);
}
