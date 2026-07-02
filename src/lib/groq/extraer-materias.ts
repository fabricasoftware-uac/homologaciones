import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { llamarGroq, llamarGroqVision, ErrorIANoDisponible } from "./cliente";
import { llamarGemini, llamarGeminiVision } from "@/lib/gemini/cliente";

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

// SENA: en vez de materias organizadas por semestre, el SENA estructura su formación por
// COMPETENCIAS, cada una con RESULTADOS DE APRENDIZAJE (RA) e INTENSIDAD HORARIA (IH).
// Extraemos CADA COMPETENCIA como UNA SOLA materia, con su nombre y todos los RAs en el
// campo "nombre". El formato JSON es IDÉNTICO al universitario ({"materias": [...]})
// para que el modelo no tenga que cambiar de estructura.
const SISTEMA_SENA = `Eres un extractor de datos académicos especializado en certificados del SENA de Colombia. Recibes el TEXTO de una constancia de notas de formación titulada, donde los contenidos NO son materias sino COMPETENCIAS con RESULTADOS DE APRENDIZAJE (RA).

Formato SENA: cada bloque tiene nombre de COMPETENCIA, "REGISTRO DE COMPETENCIAS EVALUADAS", "IH" (horas), evaluación (A = Aprobado) y "RESULTADOS DE APRENDIZAJE" con items numerados.

Extrae CADA COMPETENCIA como UNA SOLA materia. Para cada una:
- nombre: arma UN SOLO TEXTO que incluya el nombre de la competencia y todos sus RAs, con este formato: "Competencia:\\n<nombre>\\n\\nResultados de aprendizaje:\\n- <RA1>\\n- <RA2>\\n- <RA3>"
- codigo: null
- creditos: el número de horas (IH) como entero, SIN dividir
- nota: "Aprobado"
- semestre_origen: null

No inventes competencias. Ignora encabezados y firma.
Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "Competencia:\\nDesarrollar la solucion de software\\n\\nResultados de aprendizaje:\\n- Planear actividades\\n- Construir la base de datos", "codigo": null, "creditos": 1008, "nota": "Aprobado", "semestre_origen": null}]}`;

const SISTEMA_VISION_SENA = `Eres un extractor de datos académicos especializado en certificados del SENA. Recibes IMÁGENES de una constancia con COMPETENCIAS y RESULTADOS DE APRENDIZAJE (RA).

Lee las imágenes y extrae CADA COMPETENCIA como UNA SOLA materia. Para cada una:
- nombre: arma UN SOLO TEXTO con la competencia y todos sus RAs: "Competencia:\\n<nombre>\\n\\nResultados de aprendizaje:\\n- <RA1>\\n- <RA2>..."
- codigo: null
- creditos: el número de horas (IH) como entero, SIN dividir
- nota: "Aprobado"
- semestre_origen: null

Responde ÚNICAMENTE un objeto JSON con esta forma:
{"materias": [{"nombre": "Competencia:\\nDesarrollar la solucion de software\\n\\nResultados de aprendizaje:\\n- Planear actividades\\n- Construir la base de datos", "codigo": null, "creditos": 1008, "nota": "Aprobado", "semestre_origen": null}]}`;

const MAX_PAGINAS_VISION = 8;

function aNumeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function aEnteroONull(valor: unknown): number | null {
  const n = aNumeroONull(valor);
  return n !== null && Number.isInteger(n) ? n : null;
}

function aTextoONull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

function parsearMaterias(contenido: string | null): MateriaExtraida[] {
  if (!contenido) return [];
  try {
    const parsed = JSON.parse(contenido) as { materias?: unknown[] };
    const lista = Array.isArray(parsed.materias) ? parsed.materias : [];
    return lista
      .map((cruda): MateriaExtraida | null => {
        const m = cruda as Record<string, unknown>;
        const nombre = aTextoONull(m.nombre);
        if (!nombre) return null;
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

// Intenta parsear JSON de una respuesta que puede venir con texto alrededor, markdown, etc.
// A diferencia de parsearMaterias (que espera JSON limpio de json_mode), esta función es más
// tolerante: busca el primer { y el último } e intenta parsear ese fragmento.
function extraerJsonDeTexto(contenido: string | null): string | null {
  if (!contenido) return null;
  // Intento directo (el modelo pudo responder JSON limpio aunque no estuviera en json_mode).
  try {
    JSON.parse(contenido);
    return contenido;
  } catch { /* seguimos */ }
  // Buscar bloque de código markdown: ```json ... ```
  const md = contenido.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (md?.[1]) {
    try {
      JSON.parse(md[1]);
      return md[1];
    } catch { /* seguimos */ }
  }
  // Buscar el rango del primer { al último }.
  const inicio = contenido.indexOf("{");
  const fin = contenido.lastIndexOf("}");
  if (inicio !== -1 && fin > inicio) {
    const fragmento = contenido.slice(inicio, fin + 1);
    try {
      JSON.parse(fragmento);
      return fragmento;
    } catch { /* no hay JSON válido */ }
  }
  return null;
}

export async function extraerMateriasDeTexto(
  texto: string,
  esSena = false,
): Promise<MateriaExtraida[]> {
  const recorte = texto.slice(0, 12000);
  const sistemaPrompt = esSena ? SISTEMA_SENA : SISTEMA;
  // SENA: NO usamos JSON mode porque el texto del SENA (competencias, RAs, IH, formato tabular)
  // es tan distinto al universitario que TODOS los modelos de Groq fallan el json_validate.
  // En vez de eso, dejamos que el modelo responda libre y extraemos el JSON nosotros.
  const jsonMode = !esSena;

  const contenidoCrudo =
    (await llamarGroq(
      [
        { role: "system", content: sistemaPrompt },
        { role: "user", content: recorte },
      ],
      { json: jsonMode },
    )) ??
    (await llamarGemini(
      [
        { role: "system", content: sistemaPrompt },
        { role: "user", content: recorte },
      ],
      // Gemini también falla si forzamos json_mode con texto SENA; por eso mismo flag.
      { json: jsonMode },
    ));

  if (contenidoCrudo === null) {
    throw new ErrorIANoDisponible("No se pudieron extraer las materias del certificado (texto).");
  }

  const contenidoJson = esSena ? extraerJsonDeTexto(contenidoCrudo) : contenidoCrudo;
  if (!contenidoJson) {
    console.error("[groq] No se pudo extraer JSON de la respuesta SENA:", contenidoCrudo.slice(0, 500));
    throw new ErrorIANoDisponible("No se pudieron extraer las materias del certificado (texto).");
  }
  return parsearMaterias(contenidoJson);
}

function dedupePorNombre(lista: MateriaExtraida[]): MateriaExtraida[] {
  const vistas = new Set<string>();
  return lista.filter((m) => {
    const clave = m.nombre.toLowerCase().trim();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

export async function extraerMateriasPorVision(
  bytes: Uint8Array,
  esSena = false,
): Promise<MateriaExtraida[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_VISION);

  const promptVision = esSena ? SISTEMA_VISION_SENA : SISTEMA_VISION;
  const materias: MateriaExtraida[] = [];
  let huboFallo = false;

  for (let i = 1; i <= paginas; i++) {
    const url = await renderPageAsImage(bytes.slice(), i, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 1.5,
      toDataURL: true,
    });
    if (typeof url !== "string") continue;

    const contenido =
      (await llamarGroqVision(promptVision, [url], i - 1)) ??
      (await llamarGeminiVision(promptVision, [url], i - 1));

    if (contenido === null) {
      huboFallo = true;
      continue;
    }
    materias.push(...parsearMaterias(contenido));
  }

  if (materias.length === 0 && huboFallo) {
    throw new ErrorIANoDisponible("No se pudo leer el certificado escaneado (posible falta de cupo).");
  }
  return dedupePorNombre(materias);
}
