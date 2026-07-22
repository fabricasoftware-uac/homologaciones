import { llamarOpenRouter, MODELOS_LIGEROS as MODELOS_LIGEROS_OR } from "@/lib/openrouter/cliente";

// Fase 5 · Emparejamiento con IA.
//
// Le pasamos a la IA dos listas —las materias que el estudiante cursó en origen y las asignaturas
// del pensum destino— y le pedimos que diga qué homologa con qué y con qué porcentaje.
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

// Extrae JSON de una respuesta que puede venir con markdown o texto alrededor.
function extraerJson(texto: string): string | null {
  // Intento directo
  try { JSON.parse(texto); return texto; } catch { /* no */ }
  // Bloque markdown ```json ... ```
  const md = texto.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (md?.[1]) { try { JSON.parse(md[1]); return md[1]; } catch { /* no */ } }
  // Primer { al último }
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio !== -1 && fin > inicio) {
    const frag = texto.slice(inicio, fin + 1);
    try { JSON.parse(frag); return frag; } catch { /* no */ }
  }
  return null;
}

const SISTEMA = `Eres un experto en homologación de asignaturas universitarias en Colombia. Recibes un JSON con:
- materias_origen: las materias o competencias que el estudiante cursó en su institución de origen (cada una con su índice "i").
- asignaturas_destino: las asignaturas del plan de estudios destino (cada una con su índice "j").

Tu tarea: revisa CADA materia/competencia de origen y encuéntrale su(s) asignatura(s) destino equivalente(s). Sé GENEROSO y EXHAUSTIVO: el objetivo es homologar la mayor cantidad posible, sin inventar equivalencias falsas.

Reglas:
- Si los nombres son IGUALES o casi iguales, es una equivalencia segura: emparéjalas con similitud 95-100. NUNCA dejes por fuera una materia cuyo nombre coincide.
- Ignora diferencias de mayúsculas, tildes y numeración (I/II equivale a 1/2). Ejemplos de equivalencias: "Cálculo I" = "Cálculo Diferencial"; "Programación I" = "Introducción a la Programación" = "Fundamentos de Programación"; "Bases de Datos" = "Sistemas de Información"; "Inglés I" = "Lengua Extranjera I".
- Empareja también por equivalencia temática o de contenido, no solo por texto exacto.
- Asigna la similitud (0 a 100) según qué tan equivalentes son. Incluye los emparejamientos con similitud de 35 o más.
- Una materia/competencia de origen PUEDE ser equivalente a VARIAS asignaturas destino si su contenido cubre los objetivos de aprendizaje de cada una. Pero cada asignatura destino se homologa con a lo sumo UNA materia/competencia de origen.
- Las COMPETENCIAS (formación SENA, traen resultados de aprendizaje) son AMPLIAS: es normal y esperado y OBLIGATORIO si es sena que cubra 2, 3 o más asignaturas destino (p. ej. una competencia de inglés cubre "Inglés I", "Inglés II" y "Inglés III"; una de desarrollo de software cubre "Programación I" y "Programación II"). Con cada competencia, revisa TODAS las asignaturas destino y emite UN vínculo por CADA una que sus resultados de aprendizaje cubran — no te detengas en la primera. Si la materia a homologar destino es muy especializada y es de matemáticas OBLIGATORIO y no está cubierta por la competencia, NO la homologues ej (Calculo 1 si, Calculo 2 no o calculo 3).
- Para CADA emparejamiento incluye "razon": una justificación BREVE (máximo 15 palabras, en español) de por qué son equivalentes (p. ej. "ambas cubren cálculo diferencial e integral").\n- La respuesta debe ser un JSON válido.

Responde ÚNICAMENTE un objeto JSON con esta forma:
{"vinculos": [{"materia": 0, "asignatura": 0, "similitud": 0, "razon": ""}]}`;

// ── FASE 7 · Emparejamiento PER-UNIDAD ──
//
// En vez del mega-prompt (todas las materias × todas las asignaturas, origen de los 429 y de los
// json_validate_failed con payloads grandes), esta función juzga UNA unidad de origen contra su
// lista corta de candidatos (el Top-N que eligió la búsqueda vectorial). Llamadas pequeñas = JSON
// estable, rate limit repartido, y el resultado es cacheable por (unidad × pensum).

const SISTEMA_UNIDAD = `Eres un experto en homologación académica universitaria en Colombia. Recibes UNA materia o competencia de origen (con su descripción y resultados de aprendizaje si los tiene) y una lista corta de asignaturas candidatas del plan destino (cada una con su índice "j").

Tu tarea: decidir cuáles asignaturas candidatas quedan CUBIERTAS por la unidad de origen.
- Si los nombres son iguales o casi iguales, es equivalencia segura (similitud 95-100).
- Evalúa también por contenido y temática: los resultados de aprendizaje son la EVIDENCIA principal.
- Una competencia amplia puede cubrir VARIAS asignaturas; una materia normal usualmente cubre una.
- Incluye solo equivalencias con similitud 55 o más. Si ninguna candidata es equivalente, devuelve la lista vacía (es una respuesta válida y frecuente).
- Para cada equivalencia: "razon" breve (máximo 15 palabras, en español) citando la evidencia.

Responde ÚNICAMENTE un objeto JSON con esta forma:
{"vinculos": [{"asignatura": 0, "similitud": 0, "razon": ""}]}`;

export type VinculoUnidad = { asignatura: number; similitud: number; razon: string | null };

export async function emparejarUnidad(
  origen: MateriaParaEmparejar,
  candidatos: AsignaturaParaEmparejar[],
): Promise<VinculoUnidad[]> {
  if (candidatos.length === 0) return [];

  const payload = {
    unidad_origen: { nombre: origen.nombre, creditos: origen.creditos, nota: origen.nota },
    asignaturas_candidatas: candidatos.map((a, j) => ({
      j,
      nombre: a.nombre,
      creditos: a.creditos,
      semestre: a.semestre,
    })),
  };

  const mensajes = [
    { role: "system" as const, content: SISTEMA_UNIDAD },
    { role: "user" as const, content: JSON.stringify(payload) },
  ];

  const contenido =
    (await llamarOpenRouter(mensajes, { json: true, modelos: MODELOS_LIGEROS_OR, maxTokens: 2000 }));
  if (!contenido) return [];

  try {
    const parsed = JSON.parse(contenido) as { vinculos?: unknown[] };
    const crudos = Array.isArray(parsed.vinculos) ? parsed.vinculos : [];
    const resultado: VinculoUnidad[] = [];
    for (const crudo of crudos) {
      const v = crudo as Record<string, unknown>;
      const asignatura = Number(v.asignatura);
      const similitud = Number(v.similitud);
      if (!Number.isInteger(asignatura) || asignatura < 0 || asignatura >= candidatos.length) continue;
      if (!Number.isFinite(similitud) || similitud < SIMILITUD_MINIMA) continue;
      const razonCruda = typeof v.razon === "string" ? v.razon.trim() : "";
      resultado.push({
        asignatura,
        similitud: Math.max(0, Math.min(100, Math.round(similitud))),
        razon: razonCruda ? razonCruda.slice(0, 160) : null,
      });
    }
    return resultado;
  } catch {
    console.error("[ia] Emparejamiento de unidad: la respuesta no era JSON válido:", contenido);
    return [];
  }
}

// Devuelve NULL cuando la IA no estuvo disponible (todos los proveedores fallaron o la respuesta no
// fue JSON): el llamador debe tratarlo como "no se pudo preguntar", NUNCA como "no homologa nada".
// La lista vacía [] queda reservada para cuando el modelo SÍ respondió y no encontró equivalencias.
// Confundir ambas cachea una decisión negativa falsa: un rate-limit pasajero dejaba el caso sin
// ninguna relación para siempre (el estudiante veía "sin estimación" y el panel 0 vínculos).
export async function emparejarMaterias(
  origen: MateriaParaEmparejar[],
  destino: AsignaturaParaEmparejar[],
  permitirMultiplesPorOrigen = false,
  esSena = false,
): Promise<VinculoSugerido[] | null> {
  if (origen.length === 0 || destino.length === 0) return [];

  // Señal SENA explícita: el prompt base ya tiene instrucciones condicionales
  // ("si es sena..."), pero el LLM debe SABER que este caso ES sena.
  const promptSistema = esSena
    ? "IMPORTANTE: Este caso ES del SENA. Las unidades de origen son COMPETENCIAS, no materias tradicionales. Una competencia SENA es AMPLIA, incluye múltiples Resultados de Aprendizaje, y PUEDE y DEBE cubrir VARIAS asignaturas destino — no solo una. Busca TODAS las que tengan cobertura suficiente.\n\n" + SISTEMA
    : SISTEMA;

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

  const mensajes = [
    { role: "system" as const, content: promptSistema },
    { role: "user" as const, content: JSON.stringify(payload) },
  ];

  // Cadena de proveedores. OJO con el orden de fallos: antes, si OpenRouter RESPONDÍA pero con JSON
  // roto, se devolvía null de una vez y Gemini nunca se intentaba — un formato raro dejaba el caso
  // sin ninguna relación aunque hubiera un proveedor sano detrás. Ahora cada proveedor se intenta y
  // se PARSEA en el mismo paso: solo pasamos al siguiente si este no dio vínculos utilizables.
  const proveedores: { nombre: string; llamar: () => Promise<string | null> }[] = [
    {
      nombre: "openrouter",
      llamar: () => llamarOpenRouter(mensajes, { json: true, modelos: MODELOS_LIGEROS_OR, maxTokens: 4000 }),
    },
  ];

  for (const proveedor of proveedores) {
    const contenido = await proveedor.llamar();
    if (contenido === null) continue; // el proveedor no respondió: probamos el siguiente

    const json = extraerJson(contenido);
    if (!json) {
      console.warn(`[ia] Emparejamiento: ${proveedor.nombre} no devolvió JSON válido; probando el siguiente.`);
      continue;
    }

    try {
      const parsed = JSON.parse(json) as { vinculos?: unknown[] };
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

      // Asignación: cada destino se empareja con UNA sola materia de origen (la de mayor similitud).
      // Cuando permitirMultiplesPorOrigen es true (SENA), una misma competencia de origen PUEDE
      // homologar VARIAS asignaturas del pensum destino (1:N en el lado origen).
      candidatos.sort((a, b) => b.similitud - a.similitud);
      const materiasUsadas = new Set<number>();
      const asignaturasUsadas = new Set<number>();
      const resultado: VinculoSugerido[] = [];
      for (const v of candidatos) {
        if (asignaturasUsadas.has(v.asignatura)) continue;
        if (!permitirMultiplesPorOrigen && materiasUsadas.has(v.materia)) continue;
        materiasUsadas.add(v.materia);
        asignaturasUsadas.add(v.asignatura);
        resultado.push(v);
      }
      return resultado;
    } catch {
      console.warn(`[ia] Emparejamiento: ${proveedor.nombre} devolvió JSON no parseable; probando el siguiente.`);
    }
  }

  console.error("[ia] Emparejamiento: ningún proveedor devolvió una respuesta utilizable.");
  return null;
}
