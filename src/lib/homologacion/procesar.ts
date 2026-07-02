import { crearClienteServicio } from "@/lib/supabase/servicio";
import { emparejarMaterias } from "@/lib/groq/homologar";
import { llamarGemini } from "@/lib/gemini/cliente";
import { extraerYNormalizar, type UnidadAcademicaNormalizada } from "@/lib/extraccion";

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

  // 2 y 3. Extraer y normalizar unidades académicas del PDF.
  const resultado = await extraerYNormalizar(
    textoPdf,
    filaCaso.institucion_origen_nombre ?? "",
    bytesPdf,
  );
  const unidades = resultado.unidades;
  const esSena = resultado.tipoInstitucion === "sena";

  // Guardar en BD: nombre limpio en materia_origen.nombre. La descripción enriquecida y
  // los componentes se usan para el matching IA, no se guardan en el nombre.
  const filasDB = unidades.map((u) => ({
    caso_id: casoId,
    nombre: u.nombre,
    codigo: null,
    creditos: u.creditos,
    nota: u.nota,
    semestre_origen: u.semestre,
    tipo: u.tipo,
    metadatos: u.metadatos,
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

  // 4 y 5. Emparejar con IA y guardar los vínculos sugeridos.
  let semestreSugerido: number | null = null;
  if (idsMateria.length > 0 && asignaturas.length > 0) {
    const vinculos = await emparejarMaterias(
      unidades.map((u) => ({
        nombre: u.descripcion,
        creditos: u.creditos,
        nota: u.nota,
      })),
      asignaturas.map((a) => ({ nombre: a.nombre, creditos: a.creditos, semestre: a.semestre })),
      esSena,
    );

    const filasVinculo = vinculos
      .filter((v) => idsMateria[v.materia] && asignaturas[v.asignatura])
      .map((v) => ({
        caso_id: casoId,
        materia_origen_id: idsMateria[v.materia],
        asignatura_id: asignaturas[v.asignatura].id,
        similitud: v.similitud,
        razon: v.razon,
        // estado del vínculo queda en 'pendiente' por defecto: lo decide el admin.
      }));
    if (filasVinculo.length > 0) {
      const { error } = await supabase.from("vinculo").insert(filasVinculo);
      if (error) throw error;
    }

    // Estimamos el semestre: usamos Gemini (gemini-2.5-flash-lite) como primera opción, y si no
    // responde, caemos en el algoritmo determinístico de créditos.
    const idsHomologadas = new Set(filasVinculo.map((f) => f.asignatura_id));
    semestreSugerido =
      (await estimarSemestreConGemini(asignaturas, idsHomologadas)) ??
      estimarSemestre(asignaturas, idsHomologadas);
  }

  // 6. Caso listo para revisión.
  const { error: errorUpdate } = await supabase
    .from("caso")
    .update({ estado: "en_revision", semestre_sugerido: semestreSugerido })
    .eq("id", casoId);
  if (errorUpdate) throw errorUpdate;
}

// Usa Gemini para estimar en qué semestre quedaría el estudiante. Le pasa la lista completa de
// asignaturas del pensum (organizadas por semestre) y cuáles homologó, y le pide que razone cuál
// sería el primer semestre que todavía le quedaría por cursar. Si Gemini no responde o devuelve un
// valor inválido, devuelve null para que el pipeline caiga en el algoritmo determinístico.
async function estimarSemestreConGemini(
  asignaturas: { id: string; nombre: string; creditos: number; semestre: number }[],
  homologadas: Set<string>,
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

  const resumen: string[] = [];
  for (let sem = 1; sem <= numSemestres; sem++) {
    const d = porSemestre.get(sem);
    if (!d) continue;
    resumen.push(
      `Semestre ${sem} (${d.total} cr totales):\n  Homologadas: ${d.homologadas.join(", ") || "ninguna"}\n  NO homologadas: ${d.noHomologadas.join(", ") || "ninguna"}`,
    );
  }
  const texto = resumen.join("\n\n");

  const sistema = `Eres un asesor académico experto en homologaciones universitarias en Colombia. Recibes un resumen del plan de estudios organizado por semestre, indicando qué asignaturas homologó el estudiante y cuáles NO. Tu tarea: estimar en qué semestre quedaría el estudiante. Reglas:
- El estudiante "se salta" un semestre solo si homologó TODAS o CASI TODAS las asignaturas de ese semestre (y los anteriores).
- Si homologó la mayoría pero le faltan 1 o 2 asignaturas clave de un semestre, normalmente NO se salta ese semestre completo.
- El resultado es el PRIMER semestre que todavía le quedaría por cursar.
- Responde ÚNICAMENTE un objeto JSON con esta forma: {"semestre": 1, "razon": "explicación breve en español"}`;

  const contenido = await llamarGemini(
    [
      { role: "system", content: sistema },
      { role: "user", content: texto },
    ],
    { json: true, temperatura: 0, modelos: ["gemini-2.5-flash-lite"] },
  );

  if (!contenido) return null;

  try {
    const parsed = JSON.parse(contenido) as { semestre?: unknown; razon?: string };
    const semestre = Number(parsed.semestre);
    if (Number.isInteger(semestre) && semestre >= 1 && semestre <= numSemestres) {
      const razon = typeof parsed.razon === "string" ? parsed.razon.trim() : "";
      console.log(`[gemini] Semestre estimado: ${semestre}${razon ? ` (${razon})` : ""}`);
      return semestre;
    }
    console.warn("[gemini] Semestre estimado inválido:", contenido);
  } catch {
    console.warn("[gemini] Semestre estimado: respuesta no era JSON válido:", contenido);
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
