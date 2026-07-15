import { createHash } from "node:crypto";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { emparejarMaterias } from "@/lib/groq/homologar";
import type { UnidadAcademicaNormalizada } from "@/lib/extraccion";

// ── FASE 7 · Motor de decisión en cascada ──
//
// Decide qué asignaturas del pensum destino cubre cada unidad académica de origen, gastando lo
// MÍNIMO posible en IA. Cada unidad baja por niveles de costo creciente y se detiene en el primero
// que resuelve:
//
//   Nivel 0 · CACHÉ:   ¿ya se decidió esta unidad contra este pensum (otro estudiante del mismo
//                      programa)? → se reutiliza. 0 tokens. Incluye decisiones negativas.
//   Nivel 1 · REGLA:   ¿el nombre normalizado coincide exactamente con una asignatura? → vínculo
//                      seguro (98%). 0 tokens.
//   Nivel 2 · VECTORES: Top-N candidatas por similitud coseno (pgvector). 0 tokens (embedding ya
//                      generado en la Fase 5).
//   Nivel 3 · LLM:     juzga SOLO esa unidad contra sus pocas candidatas, con evidencia. La única
//                      llamada con costo — y su resultado se cachea para el siguiente estudiante.
//
// Toda decisión (incluida "no homologa nada") se guarda en decision_matching, así el costo del
// sistema DECRECE con el uso: el primer caso de un programa paga; los siguientes son casi gratis.
//
// La resolución de CONFLICTOS entre unidades (dos que reclaman la misma asignatura) es por caso, al
// final (greedy por similitud), porque depende del conjunto: el caché guarda decisiones por unidad,
// que sí son independientes del caso.

type Supa = ReturnType<typeof crearClienteServicio>;

export type AsignaturaDestino = { id: string; nombre: string; creditos: number; semestre: number };

export type VinculoDecidido = {
  materiaIdx: number; // índice de la unidad en el arreglo de entrada
  asignaturaId: string;
  similitud: number;
  razon: string | null;
};

// Lo que se guarda/lee del caché por (unidad × pensum).
type DecisionUnidad = { asignatura_id: string; similitud: number; razon: string | null }[];

const TOP_N_CANDIDATOS = 10;
const SIMILITUD_REGLA = 98;
const LOTE_LLM = 4; // unidades por llamada al LLM (microlote)

// Versión COMPACTA de la descripción para el payload del LLM: el nombre completo + hasta 6 RAs
// recortados. Los RAs completos (a veces 900+ chars por competencia) viven en la BD; para JUZGAR
// equivalencias, una muestra basta y ahorra ~50-70% de los tokens de entrada.
function descripcionCompacta(u: UnidadAcademicaNormalizada): string {
  if (u.componentes.length === 0) return u.descripcion.slice(0, 400);
  const ras = u.componentes.slice(0, 6).map((r) => `- ${r.slice(0, 160)}`);
  return `${u.nombre.slice(0, 250)}\n\nResultados de aprendizaje:\n${ras.join("\n")}`;
}

export function hashUnidad(texto: string): string {
  return createHash("sha256").update(texto.trim().toLowerCase()).digest("hex");
}

// Nombre canónico para la regla de igualdad: minúsculas, sin tildes, números romanos finales a
// dígitos ("Cálculo II" ≡ "calculo 2"), solo alfanumérico con espacios simples.
const ROMANOS: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

export function normalizarNombre(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Romano SOLO al final del nombre (donde las carreras numeran niveles).
  return base.replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)$/i, (m) => ROMANOS[m.toLowerCase()] ?? m);
}

export async function decidirVinculos(args: {
  supabase: Supa;
  pensumId: string;
  unidades: UnidadAcademicaNormalizada[];
  embsUnidades: (number[] | null)[];
  asignaturas: AsignaturaDestino[];
  esSena: boolean;
  // Reproceso explícito del admin: salta el Nivel 0 (leer el caché reproduciría la MISMA propuesta
  // que se quiere regenerar) y permite pisar decisiones admin NEGATIVAS ([]) al guardar las nuevas.
  ignorarCache?: boolean;
}): Promise<VinculoDecidido[]> {
  const { supabase, pensumId, unidades, embsUnidades, asignaturas, esSena, ignorarCache = false } = args;
  if (unidades.length === 0 || asignaturas.length === 0) return [];

  const hashes = unidades.map((u) => hashUnidad(u.textoEmbedding));
  const porId = new Map(asignaturas.map((a) => [a.id, a] as const));
  const decisiones = new Map<number, DecisionUnidad>();
  const stats = { cache: 0, regla: 0, llm: 0, legacy: 0 };

  // ── Nivel 0 · Caché (una sola consulta batch) ──
  if (ignorarCache) {
    console.log("[motor] Reproceso: se ignora el caché de decisiones (Nivel 0).");
  } else {
    try {
      const { data } = await supabase
        .from("decision_matching")
        .select("hash_unidad, vinculos")
        .eq("pensum_id", pensumId)
        .in("hash_unidad", hashes);
      const cacheado = new Map(
        ((data as { hash_unidad: string; vinculos: DecisionUnidad }[] | null) ?? []).map((r) => [
          r.hash_unidad,
          r.vinculos,
        ]),
      );
      hashes.forEach((h, i) => {
        const hit = cacheado.get(h);
        if (hit) {
          // Si el pensum cambió desde que se cacheó, alguna asignatura puede ya no existir: se filtra.
          decisiones.set(i, hit.filter((v) => porId.has(v.asignatura_id)));
          stats.cache++;
        }
      });
    } catch (e) {
      console.warn("[motor] Caché de decisiones no disponible; sigo sin él:", e);
    }
  }

  // ── Nivel 1 · Regla de igualdad de nombre ──
  const porNombre = new Map<string, AsignaturaDestino>();
  for (const a of asignaturas) {
    const clave = normalizarNombre(a.nombre);
    if (!porNombre.has(clave)) porNombre.set(clave, a);
  }
  for (let i = 0; i < unidades.length; i++) {
    if (decisiones.has(i)) continue;
    // SENA: saltar regla de nombre. Una competencia SENA que casualmente coincida
    // con una asignatura no debe quedarse con 1 solo vínculo — debe llegar al LLM
    // para que evalúe si cubre VARIAS asignaturas.
    if (!esSena) {
      const match = porNombre.get(normalizarNombre(unidades[i].nombre));
      if (match) {
        const decision: DecisionUnidad = [
          { asignatura_id: match.id, similitud: SIMILITUD_REGLA, razon: "Nombre equivalente en el plan destino" },
        ];
        decisiones.set(i, decision);
        stats.regla++;
        void guardarDecision(supabase, hashes[i], pensumId, decision, "regla", ignorarCache);
        continue;
      }
    }
  }

  // ── Nivel 2 · Vectores: candidatas Top-N por unidad pendiente (con su similitud coseno, que
  // además sirve de RED si el LLM no está disponible) ──
  type Candidata = { asignatura: AsignaturaDestino; similitud: number };
  const pendientes: { idx: number; candidatas: Candidata[] }[] = [];
  const sinEmbedding: number[] = [];
  for (let i = 0; i < unidades.length; i++) {
    if (decisiones.has(i)) continue;
    const emb = embsUnidades[i];
    if (!emb) {
      sinEmbedding.push(i);
      continue;
    }
    try {
      const { data } = await supabase.rpc("buscar_asignaturas_similares", {
        p_pensum_id: pensumId,
        p_embedding: JSON.stringify(emb),
        p_top_n: unidades[i].tipo === "competencia" ? 30 : TOP_N_CANDIDATOS,
      });
      const candidatas = ((data as { id: string; similitud: number }[] | null) ?? [])
        .map((r) => {
          const asignatura = porId.get(r.id);
          return asignatura
            ? { asignatura, similitud: Math.round(Number(r.similitud) * 100) }
            : null;
        })
        .filter((c): c is Candidata => c !== null);
      if (candidatas.length === 0) {
        sinEmbedding.push(i); // el pensum no tiene embeddings todavía: va por el camino legacy
        continue;
      }
      pendientes.push({ idx: i, candidatas });
    } catch (e) {
      console.warn(`[motor] Falló la búsqueda vectorial para la unidad ${i}; va por legacy:`, e);
      sinEmbedding.push(i);
    }
  }

  // ── Nivel 3 · LLM en MICROLOTES ──
  // Agrupar ~4 unidades por llamada (contra la UNIÓN de sus candidatas) recorta 19 llamadas a ~5:
  // menos prompt repetido (el system prompt 19 veces era puro desperdicio), menos presión sobre el
  // límite de tokens/min y menos latencia total, con payloads que siguen siendo chicos y JSON
  // estable. Trade-off consciente: el dedup interno del lote puede quitarle una candidata a una
  // unidad si otra del mismo lote la reclama con más similitud (impureza menor del caché); la
  // restricción global del caso se aplica al final de todos modos.
  // Lotes donde la IA NO estuvo disponible: sus unidades caen a la red de similitud vectorial al
  // final. OJO: no van al camino legacy (una llamada aún más grande contra el mismo proveedor caído)
  // ni se cachean como decisión negativa — eso convertía un rate-limit pasajero en un "no homologa
  // nada" permanente y el caso quedaba sin ninguna relación.
  const fallidasLLM: { idx: number; candidatas: Candidata[] }[] = [];

  for (let p = 0; p < pendientes.length; p += LOTE_LLM) {
    const lote = pendientes.slice(p, p + LOTE_LLM);

    const union: AsignaturaDestino[] = [];
    const vistos = new Set<string>();
    for (const { candidatas } of lote) {
      for (const { asignatura } of candidatas) {
        if (vistos.has(asignatura.id)) continue;
        vistos.add(asignatura.id);
        union.push(asignatura);
      }
    }

    try {
      const vinculos = await emparejarMaterias(
        lote.map(({ idx }) => ({
          nombre: descripcionCompacta(unidades[idx]),
          creditos: unidades[idx].creditos,
          nota: unidades[idx].nota,
        })),
        union.map((a) => ({ nombre: a.nombre, creditos: a.creditos, semestre: a.semestre })),
        true, // múltiples por origen
        esSena, // señal SENA explícita al prompt del LLM
      );
      if (vinculos === null) {
        // La IA no respondió: NO es un "no homologa"; estas unidades van a la red vectorial.
        fallidasLLM.push(...lote);
        continue;
      }

      const porUnidad = new Map<number, DecisionUnidad>();
      for (const v of vinculos) {
        const idxGlobal = lote[v.materia]?.idx;
        if (idxGlobal === undefined || !union[v.asignatura]) continue;
        const lista = porUnidad.get(idxGlobal) ?? [];
        lista.push({ asignatura_id: union[v.asignatura].id, similitud: v.similitud, razon: v.razon });
        porUnidad.set(idxGlobal, lista);
      }
      for (const { idx } of lote) {
        const decision = porUnidad.get(idx) ?? [];
        decisiones.set(idx, decision);
        stats.llm++;
        void guardarDecision(supabase, hashes[idx], pensumId, decision, "ia", ignorarCache);
      }
    } catch (e) {
      console.warn("[motor] Falló un microlote LLM; esas unidades van a la red vectorial:", e);
      fallidasLLM.push(...lote);
    }
  }

  // ── Camino legacy (fallback): unidades sin embedding → UNA llamada contra todo el pensum ──
  // Mantiene el comportamiento pre-Fase 7 cuando no hay vectores (p. ej. sin key de embeddings).
  if (sinEmbedding.length > 0) {
    stats.legacy = sinEmbedding.length;
    const vinculos = await emparejarMaterias(
      sinEmbedding.map((i) => ({
        nombre: descripcionCompacta(unidades[i]),
        creditos: unidades[i].creditos,
        nota: unidades[i].nota,
      })),
      asignaturas.map((a) => ({ nombre: a.nombre, creditos: a.creditos, semestre: a.semestre })),
      esSena,
    );
    if (vinculos === null) {
      // Sin IA y sin embeddings no hay nada que proponer para estas unidades; quedan sin decisión
      // (y SIN cachear) para que el próximo procesamiento vuelva a intentarlo.
      console.warn(`[motor] IA no disponible para ${sinEmbedding.length} unidades legacy; quedan sin propuesta.`);
    } else {
      const porUnidad = new Map<number, DecisionUnidad>();
      for (const v of vinculos) {
        const idxGlobal = sinEmbedding[v.materia];
        if (idxGlobal === undefined || !asignaturas[v.asignatura]) continue;
        const lista = porUnidad.get(idxGlobal) ?? [];
        lista.push({ asignatura_id: asignaturas[v.asignatura].id, similitud: v.similitud, razon: v.razon });
        porUnidad.set(idxGlobal, lista);
      }
      for (const i of sinEmbedding) {
        const decision = porUnidad.get(i) ?? [];
        decisiones.set(i, decision);
        void guardarDecision(supabase, hashes[i], pensumId, decision, "ia", ignorarCache);
      }
    }
  }

  // ── Red vectorial: si el LLM no estuvo disponible, la similitud coseno propone directo ──
  // Es una sugerencia degradada pero útil (los embeddings ya ubicaron las candidatas correctas casi
  // siempre): el asesor la revisa como cualquier otra. NO se cachea — el siguiente caso del programa
  // debe volver a intentar el juicio del LLM, que sí razona sobre el contenido.
  if (fallidasLLM.length > 0) {
    const UMBRAL_VECTORIAL = 75;
    let conRed = 0;
    for (const { idx, candidatas } of fallidasLLM) {
      const decision: DecisionUnidad = candidatas
        .filter((c) => c.similitud >= UMBRAL_VECTORIAL)
        .slice(0, 3)
        .map((c) => ({
          asignatura_id: c.asignatura.id,
          similitud: c.similitud,
          razon: "Sugerencia por similitud semántica (la IA de emparejamiento no respondió)",
        }));
      if (decision.length > 0) {
        decisiones.set(idx, decision);
        conRed++;
      }
    }
    console.warn(
      `[motor] IA de emparejamiento caída para ${fallidasLLM.length} unidades: ${conRed} rescatadas por similitud vectorial (sin cachear).`,
    );
  }

  console.log(
    `[motor] Decisiones: ${stats.cache} caché · ${stats.regla} regla · ${stats.llm} LLM en microlotes de ${LOTE_LLM} · ${stats.legacy} legacy · ${fallidasLLM.length} sin IA (de ${unidades.length} unidades).`,
  );

  // ── Resolución global del caso: cada asignatura destino se homologa a lo sumo UNA vez; cada
  // unidad de origen a lo sumo una vez, salvo SENA (una competencia puede cubrir varias). Greedy de
  // mayor a menor similitud, como el comportamiento histórico. ──
  const planos: VinculoDecidido[] = [];
  for (const [idx, decision] of decisiones) {
    for (const d of decision) {
      planos.push({ materiaIdx: idx, asignaturaId: d.asignatura_id, similitud: d.similitud, razon: d.razon });
    }
  }
  planos.sort((a, b) => b.similitud - a.similitud);

  const asignaturasUsadas = new Set<string>();
  const materiasUsadas = new Set<number>();
  const resultado: VinculoDecidido[] = [];
  for (const v of planos) {
    if (asignaturasUsadas.has(v.asignaturaId)) continue;
    if (!esSena && materiasUsadas.has(v.materiaIdx)) continue;
    asignaturasUsadas.add(v.asignaturaId);
    materiasUsadas.add(v.materiaIdx);
    resultado.push(v);
  }
  return resultado;
}

// Upsert best-effort al caché: fallar aquí jamás debe romper el caso (por eso void + catch interno).
async function guardarDecision(
  supabase: Supa,
  hash: string,
  pensumId: string,
  vinculos: DecisionUnidad,
  fuente: "ia" | "regla",
  pisarAdminNegativa = false,
): Promise<void> {
  try {
    // Una decisión HUMANA nunca se pisa con una automática: si el asesor ya decidió esta unidad
    // contra este pensum, la IA no la toca. Excepción (solo en reproceso explícito): una decisión
    // admin NEGATIVA ([]) sí puede pisarse — "no homologa nada" no debe bloquear la regeneración
    // para siempre; las decisiones admin CON vínculos siguen siendo intocables.
    const { data: existente } = await supabase
      .from("decision_matching")
      .select("fuente, vinculos")
      .eq("hash_unidad", hash)
      .eq("pensum_id", pensumId)
      .maybeSingle();
    const fila = existente as { fuente?: string; vinculos?: DecisionUnidad } | null;
    if (fila?.fuente === "admin") {
      const esNegativa = !fila.vinculos || fila.vinculos.length === 0;
      if (!(pisarAdminNegativa && esNegativa)) return;
    }

    await supabase
      .from("decision_matching")
      .upsert(
        { hash_unidad: hash, pensum_id: pensumId, vinculos, fuente, actualizado_en: new Date().toISOString() },
        { onConflict: "hash_unidad,pensum_id" },
      );
  } catch (e) {
    console.warn("[motor] No se pudo guardar la decisión en caché:", e);
  }
}

// ── FASE 7 · Cierre del loop de aprendizaje ──
//
// Cuando el asesor CONFIRMA, corrige o quita vínculos de una materia en el estudio, su decisión se
// cachea con fuente 'admin': el siguiente estudiante que traiga esa MISMA unidad (mismo programa)
// contra ese pensum recibe la decisión humana directamente — 0 tokens y con la autoridad del asesor.
// La corrección se hace UNA vez y aplica para siempre; la IA nunca pisa una decisión 'admin'.
//
// Se cachea el estado APROBADO actual de la materia (puede ser vacío = "el asesor decidió que no
// homologa nada aquí", también valioso). Usa el cliente de SERVICIO porque decision_matching es
// tabla interna (RLS sin policies) y quien llama es la sesión del admin. Best-effort: nunca lanza.
export async function actualizarDecisionAdmin(materiaOrigenId: string): Promise<void> {
  try {
    const servicio = crearClienteServicio();

    const { data: mat } = await servicio
      .from("materia_origen")
      .select("texto_embedding, nombre, caso_id")
      .eq("id", materiaOrigenId)
      .maybeSingle();
    if (!mat) return;
    const fila = mat as { texto_embedding: string | null; nombre: string; caso_id: string };

    const { data: casoRow } = await servicio
      .from("caso")
      .select("pensum_destino_id")
      .eq("id", fila.caso_id)
      .maybeSingle();
    const pensumId = (casoRow as { pensum_destino_id: string } | null)?.pensum_destino_id;
    if (!pensumId) return;

    const { data: vincs } = await servicio
      .from("vinculo")
      .select("asignatura_id, similitud, razon")
      .eq("materia_origen_id", materiaOrigenId)
      .eq("estado", "aprobado");
    const decision: DecisionUnidad = (
      (vincs as { asignatura_id: string; similitud: number; razon: string | null }[] | null) ?? []
    ).map((v) => ({
      asignatura_id: v.asignatura_id,
      similitud: v.similitud,
      razon: v.razon ?? "Confirmado por un asesor",
    }));

    const hash = hashUnidad(fila.texto_embedding ?? fila.nombre);
    await servicio
      .from("decision_matching")
      .upsert(
        { hash_unidad: hash, pensum_id: pensumId, vinculos: decision, fuente: "admin", actualizado_en: new Date().toISOString() },
        { onConflict: "hash_unidad,pensum_id" },
      );
    console.log(
      `[motor] Decisión del asesor cacheada (${decision.length} vínculo(s)): aplicará a futuros casos del mismo programa.`,
    );
  } catch (e) {
    console.warn("[motor] No se pudo cachear la decisión del asesor:", e);
  }
}
