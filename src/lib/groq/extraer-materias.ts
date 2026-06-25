import { llamarGroq } from "./cliente";

// Fase 4 · Extracción de materias del PDF.
//
// Recibe el TEXTO del certificado de notas / historial académico (ya extraído del PDF) y le pide a
// Groq que lo convierta en una lista estructurada de materias. Sanitizamos cada campo: la IA puede
// devolver números como texto, campos faltantes, etc.

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

function aNumeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function aTextoONull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

export async function extraerMateriasDeTexto(texto: string): Promise<MateriaExtraida[]> {
  const recorte = texto.slice(0, 12000); // suficiente para un historial completo; controla tokens
  const contenido = await llamarGroq(
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: recorte },
    ],
    { json: true },
  );
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
          creditos: aNumeroONull(m.creditos),
          nota: aTextoONull(m.nota),
          semestre_origen: aNumeroONull(m.semestre_origen),
        };
      })
      .filter((m): m is MateriaExtraida => m !== null);
  } catch {
    console.error("[groq] Extracción de materias: la respuesta no era JSON válido:", contenido);
    return [];
  }
}
