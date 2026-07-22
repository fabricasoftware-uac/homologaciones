import { createHash } from "node:crypto";

import { crearClienteServicio } from "@/lib/supabase/servicio";

import { llamarOpenRouter } from "@/lib/openrouter/cliente";
import { llamarGemini } from "@/lib/gemini/cliente";
import { generarEmbeddings } from "@/lib/gemini/cliente";
import { mapaConcurrente } from "@/lib/concurrencia";
import {
  extraerYNormalizar,
  detectarInstitucion,
  type UnidadAcademicaNormalizada,
} from "@/lib/extraccion";
import { decidirVinculos } from "./motor";

// Orquestador del pipeline de homologación (Fases 4 + 5). Corre como "el sistema" (cliente con la
// secret key), porque escribe materia_origen y vínculos —tablas que el invitado solo puede leer— y
// actualiza el estado del caso.
//
// Pasos: (1) lee el pensum destino del caso, (2) extrae las materias del texto del PDF, (3) las
// guarda, (4) las empareja con las asignaturas destino vía IA, (5) guarda los vínculos sugeridos y
// (6) deja el caso en 'en_revision' con el semestre sugerido, listo para que el admin lo revise.
//
// Está aislado a propósito: hoy se llama de forma síncrona al enviar la solicitud, pero podría
// moverse a un job en segundo plano sin tocar esta lógica. Si algo falla, lanza: quien lo invoca
// decide (al enviar, dejamos el caso en 'procesando' para reprocesarlo, sin romperle el envío al
// estudiante).
export async function procesarCaso(
  casoId: string,
  textoPdf: string,
  bytesPdf?: Uint8Array,
  // ignorarCache: reproceso explícito del admin — el motor salta el caché de decisiones para
  // regenerar la propuesta de verdad (si no, el Nivel 0 reproduciría exactamente lo mismo).
  opciones?: { ignorarCache?: boolean },
): Promise<void> {
  const supabase = crearClienteServicio();

  // 1. Datos del caso: pensum destino y si viene del SENA (lo detectamos del nombre de la
  // institución, que el estudiante seleccionó en el formulario).
  const { data: caso, error: errorCaso } = await supabase
    .from("caso")
    .select("pensum_destino_id, institucion_origen_nombre")
    .eq("id", casoId)
    .single();
  if (errorCaso || !caso) {
    throw new Error(`No se encontró el caso ${casoId}: ${errorCaso?.message ?? "sin datos"}`);
  }
  const filaCaso = caso as { pensum_destino_id: string; institucion_origen_nombre: string | null };
  const pensumDestinoId = filaCaso.pensum_destino_id;

  // Asignaturas del pensum destino, ordenadas por semestre (el orden fija el índice que ve la IA).
  const { data: asignaturasRaw } = await supabase
    .from("asignatura")
    .select("id, nombre, creditos, semestre")
    .eq("pensum_id", pensumDestinoId)
    .order("semestre");
  const asignaturas =
    (asignaturasRaw as { id: string; nombre: string; creditos: number; semestre: number }[] | null) ??
    [];

  // FASE 5: aseguramos que las asignaturas destino tengan su embedding (lazy backfill). Solo genera
  // los que faltan; best-effort (si falla o no hay key, el pipeline sigue igual). Aún NO se usan para
  // búsqueda: eso es la Fase 6. Prepararlos aquí deja el pensum listo para el Top-N.
  try {
    await asegurarEmbeddingsAsignaturas(supabase, pensumDestinoId);
  } catch (e) {
    console.warn("[embeddings] No se pudieron generar embeddings de asignaturas:", e);
  }

  // FASE 7 (dedup): huella del documento. Si este MISMO PDF ya se procesó (reenvío, o el programa
  // del SENA que comparten miles de estudiantes), reutilizamos sus unidades normalizadas y sus
  // embeddings tal cual: 0 tokens de extracción y 0 de embeddings.
  const hashDocumento = createHash("sha256")
    .update(bytesPdf ?? textoPdf)
    .digest("hex");

  let unidades: UnidadAcademicaNormalizada[];
  let embsUnidades: (number[] | null)[];
  let metodoExtraccion: string;
  let tipoInstitucion: string;

  // El reuso exige que el TIPO de institución detectado coincida: el mismo PDF procesado antes bajo
  // "SENA" (mal etiquetado) dejó unidades interpretadas como competencias (créditos ÷48, semestres
  // borrados); reusarlas para un caso universitario propaga la corrupción.
  const tipoDetectado = detectarInstitucion(filaCaso.institucion_origen_nombre ?? "");
  const previa = await buscarExtraccionPrevia(supabase, hashDocumento, casoId, tipoDetectado);
  if (previa) {
    unidades = previa.unidades;
    embsUnidades = previa.embsUnidades;
    metodoExtraccion = `${previa.metodo} (reuso)`;
    tipoInstitucion = previa.tipoInstitucion;
    console.log(
      `[dedup] Documento ya procesado (caso ${previa.casoId}): reutilizo ${unidades.length} unidades y embeddings (0 tokens).`,
    );
  } else {
    // 2 y 3. Extraer y normalizar unidades académicas del PDF.
    const resultado = await extraerYNormalizar(
      textoPdf,
      filaCaso.institucion_origen_nombre ?? "",
      bytesPdf,
    );
    unidades = resultado.unidades;
    metodoExtraccion = resultado.metodo;
    tipoInstitucion = resultado.tipoInstitucion;

    // FASE 5: embedding de cada unidad desde su texto_embedding. Best-effort: si Gemini no responde
    // (o no hay key), queda null y el pipeline sigue igual (el motor cae al camino legacy).
    embsUnidades = await generarEmbeddings(unidades.map((u) => u.textoEmbedding));
  }
  const esSena = tipoInstitucion === "sena";

  const filasDB = unidades.map((u, idx) => ({
    caso_id: casoId,
    nombre: u.nombre,
    codigo: null,
    creditos: u.creditos,
    nota: u.nota,
    semestre_origen: u.semestre,
    tipo: u.tipo,
    metadatos: u.metadatos,
    intensidad_horaria: u.intensidadHoraria,
    descripcion: u.descripcion,
    componentes: u.componentes,
    texto_embedding: u.textoEmbedding,
    embedding: embsUnidades[idx] ? JSON.stringify(embsUnidades[idx]) : null,
  }));

  let idsMateria: string[] = [];
  if (unidades.length > 0) {
    const { data: insertadas, error } = await supabase
      .from("materia_origen")
      .insert(filasDB)
      .select("id");
    if (error) throw error;
    idsMateria = ((insertadas as { id: string }[] | null) ?? []).map((r) => r.id);
  }

  // 4 y 5. Decidir vínculos con el MOTOR EN CASCADA (Fase 7) y guardarlos. El motor gasta lo mínimo:
  // caché de decisiones (0 tokens) → regla de nombre (0) → Top-N vectorial (0) → LLM solo para lo que
  // quede, una unidad por llamada. Fallback interno al camino legacy si no hay embeddings.
  let semestreSugerido: number | null = null;
  if (idsMateria.length > 0 && asignaturas.length > 0) {
    const decididos = await decidirVinculos({
      supabase,
      pensumId: pensumDestinoId,
      unidades,
      embsUnidades,
      asignaturas,
      esSena,
      ignorarCache: opciones?.ignorarCache ?? false,
    });

    const filasVinculo = decididos
      .filter((v) => idsMateria[v.materiaIdx])
      .map((v) => ({
        caso_id: casoId,
        materia_origen_id: idsMateria[v.materiaIdx],
        asignatura_id: v.asignaturaId,
        similitud: v.similitud,
        razon: v.razon,
        // estado del vínculo queda en 'pendiente' por defecto: lo decide el admin.
      }));
    if (filasVinculo.length > 0) {
      const { error } = await supabase.from("vinculo").insert(filasVinculo);
      if (error) throw error;
    }

    // Si no se generó NINGÚN vínculo teniendo unidades extraídas, la IA probablemente
    // no respondió. Dejamos nota para el estudiante y NO estimamos semestre (sería
    // engañoso decir "semestre 1" cuando en realidad la IA no pudo evaluar).
    if (filasVinculo.length === 0) {
      await supabase
        .from("caso")
        .update({
          estado: "en_revision",
          semestre_sugerido: null,
          nota_admin: "La IA no está disponible en este momento. Un asesor de la Autónoma del Cauca revisará tu caso manualmente y te contactará con el resultado definitivo.",
        })
        .eq("id", casoId);
      return;
    }

    // Estimamos el semestre: usamos Gemini (gemini-2.5-flash-lite) como primera opción, y si no
    // responde, caemos en el algoritmo determinístico de créditos.
    const idsHomologadas = new Set(filasVinculo.map((f) => f.asignatura_id));
    semestreSugerido =
      (await estimarSemestreConGemini(asignaturas, idsHomologadas, esSena)) ??
      estimarSemestre(asignaturas, idsHomologadas);
  }

  // 6. Caso listo para revisión. FASE 4: guardamos también los metadatos del DOCUMENTO —con qué
  // extractor y qué tipo de institución se procesó—, útiles para trazabilidad y para las fases
  // siguientes (búsqueda/optimización).
  const { error: errorUpdate } = await supabase
    .from("caso")
    .update({
      estado: "en_revision",
      semestre_sugerido: semestreSugerido,
      metodo_extraccion: metodoExtraccion,
      tipo_institucion: tipoInstitucion,
      hash_documento: hashDocumento,
    })
    .eq("id", casoId);
  if (errorUpdate) throw errorUpdate;
}

// FASE 5: genera y guarda los embeddings de las asignaturas del pensum que aún NO lo tengan (lazy
// backfill). Solo procesa las que están en null, así el trabajo se hace una vez por pensum: las
// asignaturas sembradas se rellenan la primera vez que se procesa un caso de esa carrera, y las
// nuevas al aparecer. Best-effort (no lanza; quien llama lo envuelve en try/catch).
async function asegurarEmbeddingsAsignaturas(
  supabase: ReturnType<typeof crearClienteServicio>,
  pensumId: string,
): Promise<void> {
  const { data } = await supabase
    .from("asignatura")
    .select("id, nombre")
    .eq("pensum_id", pensumId)
    .is("embedding", null);
  const faltan = (data as { id: string; nombre: string }[] | null) ?? [];
  if (faltan.length === 0) return;

  const embs = await generarEmbeddings(faltan.map((a) => a.nombre));

  // Un UPDATE por asignatura, pero en paralelo con tope: en serie, un pensum de 60 asignaturas eran
  // 60 viajes a Postgres encadenados la primera vez que se procesaba un caso de esa carrera — la
  // espera más larga y más desconcertante de todo el flujo, porque solo ocurre una vez por pensum.
  const escrituras = await mapaConcurrente(faltan, 6, async (asignatura, i) => {
    const e = embs[i];
    if (!e) return false;
    const { error } = await supabase
      .from("asignatura")
      .update({ embedding: JSON.stringify(e) })
      .eq("id", asignatura.id);
    return !error;
  });

  const ok = escrituras.filter(Boolean).length;
  console.log(`[embeddings] Asignaturas embebidas: ${ok}/${faltan.length} (pensum ${pensumId}).`);
}

// FASE 7 (dedup): busca un caso ANTERIOR que haya procesado este mismo documento (mismo hash) y, si
// existe, reconstruye sus unidades normalizadas y embeddings desde materia_origen. Devuelve null si
// no hay caso previo utilizable. Best-effort: cualquier fallo devuelve null y el pipeline extrae
// normal (nunca se rompe por el caché).
async function buscarExtraccionPrevia(
  supabase: ReturnType<typeof crearClienteServicio>,
  hashDocumento: string,
  casoActualId: string,
  tipoDetectado: string,
): Promise<{
  casoId: string;
  metodo: string;
  tipoInstitucion: string;
  unidades: UnidadAcademicaNormalizada[];
  embsUnidades: (number[] | null)[];
} | null> {
  try {
    const { data: prev } = await supabase
      .from("caso")
      .select("id, metodo_extraccion, tipo_institucion")
      .eq("hash_documento", hashDocumento)
      // Solo reusamos extracciones interpretadas con el MISMO tipo de institución: la lectura SENA
      // (horas→créditos, sin semestres) y la universitaria no son intercambiables.
      .eq("tipo_institucion", tipoDetectado)
      .neq("id", casoActualId)
      .not("metodo_extraccion", "is", null)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prev) return null;
    const filaPrev = prev as { id: string; metodo_extraccion: string; tipo_institucion: string | null };

    const { data: mats } = await supabase
      .from("materia_origen")
      .select(
        "nombre, creditos, intensidad_horaria, nota, semestre_origen, tipo, metadatos, descripcion, componentes, texto_embedding, embedding",
      )
      .eq("caso_id", filaPrev.id);
    const filas = (mats ?? []) as {
      nombre: string;
      creditos: number | null;
      intensidad_horaria: number | null;
      nota: string | null;
      semestre_origen: number | null;
      tipo: string | null;
      metadatos: Record<string, unknown> | null;
      descripcion: string | null;
      componentes: string[] | null;
      texto_embedding: string | null;
      embedding: unknown;
    }[];
    if (filas.length === 0) return null;

    const unidades: UnidadAcademicaNormalizada[] = filas.map((r) => ({
      nombre: r.nombre,
      descripcion: r.descripcion ?? r.nombre,
      componentes: r.componentes ?? [],
      textoEmbedding: r.texto_embedding ?? r.nombre,
      creditos: r.creditos,
      intensidadHoraria: r.intensidad_horaria,
      nota: r.nota,
      semestre: r.semestre_origen,
      tipo: r.tipo ?? "materia",
      metadatos: r.metadatos,
    }));

    // PostgREST devuelve el vector como string "[...]"; lo volvemos number[] para el motor.
    const embsUnidades: (number[] | null)[] = filas.map((r) => {
      if (!r.embedding) return null;
      try {
        const v = typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding;
        return Array.isArray(v) && v.length > 0 ? (v as number[]) : null;
      } catch {
        return null;
      }
    });

    return {
      casoId: filaPrev.id,
      // Evita "X (reuso) (reuso)" cuando el previo ya era un reuso.
      metodo: filaPrev.metodo_extraccion.replace(/ \(reuso\)$/, ""),
      tipoInstitucion: filaPrev.tipo_institucion ?? "desconocida",
      unidades,
      embsUnidades,
    };
  } catch (e) {
    console.warn("[dedup] No se pudo consultar extracciones previas; extraigo normal:", e);
    return null;
  }
}

async function estimarSemestreConGemini(
  asignaturas: { id: string; nombre: string; creditos: number; semestre: number }[],
  homologadas: Set<string>,
  esSena = false,
): Promise<number | null> {
  const numSemestres = asignaturas.reduce((max, a) => Math.max(max, a.semestre), 0);
  if (numSemestres === 0) return null;

  const porSemestre = new Map<number, { total: number; homologadas: string[]; noHomologadas: string[] }>();
  for (const a of asignaturas) {
    const agrupado = porSemestre.get(a.semestre) ?? { total: 0, homologadas: [], noHomologadas: [] };
    agrupado.total += a.creditos;
    if (homologadas.has(a.id)) {
      agrupado.homologadas.push(`${a.nombre} (${a.creditos} cr)`);
    } else {
      agrupado.noHomologadas.push(`${a.nombre} (${a.creditos} cr)`);
    }
    porSemestre.set(a.semestre, agrupado);
  }

  const creditosHomologados = asignaturas
    .filter((a) => homologadas.has(a.id))
    .reduce((s, a) => s + a.creditos, 0);
  const creditosTotales = asignaturas.reduce((s, a) => s + a.creditos, 0);
  const pct = creditosTotales > 0 ? Math.round((creditosHomologados / creditosTotales) * 100) : 0;

  const resumen: string[] = [];
  for (let sem = 1; sem <= numSemestres; sem++) {
    const d = porSemestre.get(sem);
    if (!d) continue;
    resumen.push(
      `Semestre ${sem} (${d.total} cr): Homologadas: ${d.homologadas.join(", ") || "ninguna"} | NO: ${d.noHomologadas.join(", ") || "ninguna"}`,
    );
  }
  const texto = `Créditos homologados: ${creditosHomologados} de ${creditosTotales} (${pct}%)\n\n` + resumen.join("\n");

  let sistema =
    "Eres un asesor académico experto en homologaciones. Recibes el resumen de un plan de estudios con los créditos homologados por un estudiante y los que NO. Tu tarea: estimar en qué semestre quedaría.\n\n" +
    "Reglas:\n" +
    "- El porcentaje de créditos homologados es tu guía PRINCIPAL: " + pct + "% de " + creditosTotales + " créditos en " + numSemestres + " semestres.\n" +
    "- Estima PROPORCIONALMENTE: " + pct + "% de " + numSemestres + " semestres = aproximadamente semestre " + Math.max(1, Math.round((pct / 100) * numSemestres)) + ".\n" +
    "- NO importa el orden de los semestres: si hay materias homologadas en semestre 7, el estudiante puede que ya está en ese nivel aunque falten materias de semestre 1, esto depende de los creditos homologados en total.\n" +
    "- Redondea SIEMPRE hacia arriba si estás en duda.\n" +
    "- Responde ÚNICAMENTE un objeto JSON: {\"semestre\": 1, \"razon\": \"breve\"}";

  if (esSena) {
    sistema +=
      "\n\nSENA: Las competencias del SENA se miden en HORAS, no créditos. Una competencia de 1008h cubre muchísimo más que una materia de 3cr. El porcentaje de créditos SUBESTIMA el nivel real. Sé mas generoso con los semestres al estimado proporcional.";
  }

  const mensajes = [
    { role: "system" as const, content: sistema },
    { role: "user" as const, content: texto },
  ];

  const contenido =
    (await llamarOpenRouter(mensajes, { json: true, temperatura: 0, maxTokens: 500 })) ??
    (await llamarGemini(mensajes, { json: true, temperatura: 0, modelos: ["gemini-2.5-flash-lite"] }));

  if (!contenido) return null;

  try {
    const parsed = JSON.parse(contenido) as { semestre?: unknown; razon?: string };
    const semestre = Number(parsed.semestre);
    if (Number.isInteger(semestre) && semestre >= 1 && semestre <= numSemestres) {
      const razon = typeof parsed.razon === "string" ? parsed.razon.trim() : "";
      console.log(`[semestre] Estimado: ${semestre}${razon ? ` (${razon})` : ""}`);
      return semestre;
    }
    console.warn("[semestre] Valor inválido:", contenido);
  } catch {
    console.warn("[semestre] JSON inválido:", contenido);
  }

  return null;
}

// Estima en qué semestre quedaría el estudiante a partir de los créditos que homologó. Recorre el
// plan semestre a semestre acumulando los créditos que EXIGE cada uno: el estudiante "se salta" un
// semestre solo si lo homologado alcanza a cubrir todo lo de ese semestre (y los anteriores). El
// resultado es el primer semestre que todavía le quedaría por cursar. Se acota entre 1 y el total
// de semestres del plan. Es una aproximación basada en la carga real de cada semestre, no en un
// promedio; el admin la confirma o ajusta.
function estimarSemestre(
  asignaturas: { id: string; creditos: number; semestre: number }[],
  homologadas: Set<string>,
): number | null {
  const numSemestres = asignaturas.reduce((max, a) => Math.max(max, a.semestre), 0);
  if (numSemestres === 0) return null;

  const creditosHomologados = asignaturas
    .filter((a) => homologadas.has(a.id))
    .reduce((suma, a) => suma + a.creditos, 0);
  if (creditosHomologados === 0) return null;

  // Créditos que pide el plan en cada semestre.
  const creditosDelSemestre = new Map<number, number>();
  for (const a of asignaturas) {
    creditosDelSemestre.set(a.semestre, (creditosDelSemestre.get(a.semestre) ?? 0) + a.creditos);
  }

  // Vamos sumando la exigencia semestre a semestre: donde lo homologado ya no alcanza a cubrirla,
  // ahí es donde el estudiante entraría a cursar.
  let acumulado = 0;
  for (let sem = 1; sem <= numSemestres; sem++) {
    acumulado += creditosDelSemestre.get(sem) ?? 0;
    if (creditosHomologados < acumulado) return sem;
  }
  // Homologó créditos suficientes para cubrir el plan entero: lo dejamos en el último semestre.
  return numSemestres;
}
