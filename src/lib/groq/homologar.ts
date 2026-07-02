import { llamarGroq, MODELOS_LIGEROS } from "./cliente";

// Fase 5 · Emparejamiento con IA.
//
// Le pasamos a Groq dos listas —las materias que el estudiante cursó en origen y las asignaturas del
// pensum destino— y le pedimos que diga qué homologa con qué y con qué porcentaje.
//
// Truco clave: NO le pasamos los UUID de la base a la IA (los alucinaría). Cada materia y cada
// asignatura van con un ÍNDICE entero; la IA responde con esos índices y nosotros los mapeamos de
// vuelta a los UUID reales en el orquestador (procesarCaso). El semestre estimado NO lo decide la
// IA: lo calculamos en código (ver procesarCaso).

export type MateriaParaEmparejar = { nombre: string; creditos: number | null; nota: string | null };
export type AsignaturaParaEmparejar = { nombre: string; creditos: number; semestre: number };
export type VinculoSugerido = {
  materia: number;
  asignatura: number;
  similitud: number;
  razon: string | null;
};

const SIMILITUD_MINIMA = 55;

const SISTEMA = `Eres un experto en homologación de asignaturas universitarias en Colombia. Recibes un JSON con:
- materias_origen: las materias que el estudiante cursó en su universidad de origen (cada una con su índice "i").
- asignaturas_destino: las asignaturas del plan de estudios destino (cada una con su índice "j").

Tu tarea: revisa CADA materia de origen y encuéntrale su asignatura destino equivalente. Sé GENEROSO y EXHAUSTIVO: el objetivo es homologar la mayor cantidad posible de materias, sin inventar equivalencias falsas.

Reglas:
- Si los nombres son IGUALES o casi iguales, es una equivalencia segura: emparéjalas con similitud 95-100. NUNCA dejes por fuera una materia cuyo nombre coincide.
- Ignora diferencias de mayúsculas, tildes y numeración (I/II equivale a 1/2). Ejemplos de equivalencias: "Cálculo I" = "Cálculo Diferencial"; "Programación I" = "Introducción a la Programación" = "Fundamentos de Programación"; "Bases de Datos" = "Sistemas de Información"; "Inglés I" = "Lengua Extranjera I".
- Empareja también por equivalencia temática o de contenido, no solo por texto exacto.
- Asigna la similitud (0 a 100) según qué tan equivalentes son. Incluye los emparejamientos con similitud de 55 o más.
- Una materia de origen homologa a lo sumo una asignatura destino, y cada asignatura destino se homologa con a lo sumo una materia de origen (elige el mejor par).
- Para CADA emparejamiento incluye "razon": una justificación BREVE (máximo 12 palabras, en español) de por qué son equivalentes (p. ej. "ambas cubren cálculo diferencial e integral").

Responde ÚNICAMENTE un objeto JSON con esta forma:
{"vinculos": [{"materia": 0, "asignatura": 0, "similitud": 0, "razon": ""}]}`;

export async function emparejarMaterias(
  origen: MateriaParaEmparejar[],
  destino: AsignaturaParaEmparejar[],
): Promise<VinculoSugerido[]> {
  if (origen.length === 0 || destino.length === 0) return [];

  const payload = {
    materias_origen: origen.map((m, i) => ({
      i,
      nombre: m.nombre,
      creditos: m.creditos,
      nota: m.nota,
    })),
    asignaturas_destino: destino.map((a, j) => ({
      j,
      nombre: a.nombre,
      creditos: a.creditos,
      semestre: a.semestre,
    })),
  };

  // Emparejamiento en la cadena LIGERA (20b primero): así no compite con la extracción por el cupo
  // del 120b. Es una tarea de comparación por índices, que el 20b resuelve bien.
  const contenido = await llamarGroq(
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: JSON.stringify(payload) },
    ],
    { json: true, modelos: MODELOS_LIGEROS },
  );
  if (!contenido) return [];

  try {
    const parsed = JSON.parse(contenido) as { vinculos?: unknown[] };
    const crudos = Array.isArray(parsed.vinculos) ? parsed.vinculos : [];

    // Normalizamos y descartamos índices fuera de rango / similitudes bajas.
    const candidatos: VinculoSugerido[] = [];
    for (const crudo of crudos) {
      const v = crudo as Record<string, unknown>;
      const materia = Number(v.materia);
      const asignatura = Number(v.asignatura);
      const similitud = Number(v.similitud);
      if (!Number.isInteger(materia) || materia < 0 || materia >= origen.length) continue;
      if (!Number.isInteger(asignatura) || asignatura < 0 || asignatura >= destino.length) continue;
      if (!Number.isFinite(similitud) || similitud < SIMILITUD_MINIMA) continue;
      // Razón: texto corto, acotado por las dudas (truncamos por si la IA se extiende).
      const razonCruda = typeof v.razon === "string" ? v.razon.trim() : "";
      candidatos.push({
        materia,
        asignatura,
        similitud: Math.max(0, Math.min(100, Math.round(similitud))),
        razon: razonCruda ? razonCruda.slice(0, 160) : null,
      });
    }

    // Asignación 1-a-1: recorremos de mayor a menor similitud y nos quedamos con el mejor par para
    // cada materia y cada asignatura (sin repetir ninguna de las dos).
    candidatos.sort((a, b) => b.similitud - a.similitud);
    const materiasUsadas = new Set<number>();
    const asignaturasUsadas = new Set<number>();
    const resultado: VinculoSugerido[] = [];
    for (const v of candidatos) {
      if (materiasUsadas.has(v.materia) || asignaturasUsadas.has(v.asignatura)) continue;
      materiasUsadas.add(v.materia);
      asignaturasUsadas.add(v.asignatura);
      resultado.push(v);
    }
    return resultado;
  } catch {
    console.error("[groq] Emparejamiento: la respuesta no era JSON válido:", contenido);
    return [];
  }
}
