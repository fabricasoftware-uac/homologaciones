import { getDocumentProxy, renderPageAsImage } from "unpdf";

import { llamarGroq, llamarGroqVision, ErrorIANoDisponible } from "./cliente";
import { llamarGemini, llamarGeminiVision } from "@/lib/gemini/cliente";

export type MateriaExtraida = {
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  nota: string | null;
  semestre_origen: number | null;
  tipo?: string;
  metadatos?: Record<string, unknown> | null;
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

function aEnteroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
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
          tipo: "materia",
        };
      })
      .filter((m): m is MateriaExtraida => m !== null);
  } catch {
    console.error("[groq] Extracción de materias: la respuesta no era JSON válido:", contenido);
    return [];
  }
}

// ── Parser determinístico para certificados del SENA ──
export function parsearSENA(texto: string): MateriaExtraida[] {
  const txt = texto.replace(/\s+/g, " ").trim();

  const regex = /(.+?)\s+[\d,]+\s+([AD])\s+REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS\s+EVAL\s+IH\s+(\d+)\s+RESULTADOS\s+DE\s+APRENDIZAJE\s+(.+?)(?=\s*(?:[\d,]+\s+[AD]\s+REGISTRO|$))/g;

  const materias: MateriaExtraida[] = [];
  let m: RegExpExecArray | null;
  let esPrimero = true;

  while ((m = regex.exec(txt)) !== null) {
    let nombre = m[1].trim();
    const ih = parseInt(m[3], 10);
    const raTexto = m[4];
    const evaluacion = m[2];

    if (esPrimero) {
      const limpio = nombre.match(/(?:ha\s+)?aprobado:\s*(.+)/i);
      if (limpio) nombre = limpio[1].trim();
      esPrimero = false;
    }

    nombre = nombre.replace(/\s+/g, " ");

    const ras: string[] = [];
    const partesRA = raTexto.split(/\s+(?=\d{2}\s+)/);
    for (const p of partesRA) {
      const textoRA = p.replace(/^\d{2}\s+/, "").replace(/\s+/g, " ").trim();
      if (textoRA.length > 10) ras.push(textoRA);
    }

    const raFormateado = ras.length > 0
      ? "\n\nResultados de aprendizaje:\n" + ras.map((r) => `- ${r}`).join("\n")
      : "";

    const nota = evaluacion === "A" ? "Aprobado" : evaluacion === "D" ? "No aprobado" : evaluacion;

    materias.push({
      nombre: `Competencia:\n${nombre}${raFormateado}`,
      codigo: null,
      creditos: ih,
      nota,
      semestre_origen: null,
      tipo: "competencia",
      metadatos: { resultados_aprendizaje: ras },
    });
  }

  console.log(`[sena] Parser extrajo ${materias.length} competencias del certificado.`);
  return materias;
}

export async function extraerMateriasDeTexto(texto: string): Promise<MateriaExtraida[]> {
  const recorte = texto.slice(0, 12000);

  const contenido =
    (await llamarGroq(
      [
        { role: "system", content: SISTEMA },
        { role: "user", content: recorte },
      ],
      { json: true },
    )) ??
    (await llamarGemini(
      [
        { role: "system", content: SISTEMA },
        { role: "user", content: recorte },
      ],
      { json: true },
    ));

  if (contenido === null) {
    throw new ErrorIANoDisponible("No se pudieron extraer las materias del certificado (texto).");
  }
  return parsearMaterias(contenido);
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
