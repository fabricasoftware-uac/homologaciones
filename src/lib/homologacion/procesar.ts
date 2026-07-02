import { crearClienteServicio } from "@/lib/supabase/servicio";
import { extraerMateriasDeTexto, extraerMateriasPorVision } from "@/lib/groq/extraer-materias";
import { emparejarMaterias } from "@/lib/groq/homologar";

// Mínimo de caracteres para dar el PDF por "con texto legible" (mismo criterio que el formulario). Si
// el certificado no llega a esto, lo tratamos como escaneado y lo leemos por VISIÓN (OCR).
const MIN_TEXTO_LEGIBLE = 30;

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

  // 1. Pensum destino del caso.
  const { data: caso, error: errorCaso } = await supabase
    .from("caso")
    .select("pensum_destino_id")
    .eq("id", casoId)
    .single();
  if (errorCaso || !caso) {
    throw new Error(`No se encontró el caso ${casoId}: ${errorCaso?.message ?? "sin datos"}`);
  }
  const pensumDestinoId = (caso as { pensum_destino_id: string }).pensum_destino_id;

  // Asignaturas del pensum destino, ordenadas por semestre (el orden fija el índice que ve la IA).
  const { data: asignaturasRaw } = await supabase
    .from("asignatura")
    .select("id, nombre, creditos, semestre")
    .eq("pensum_id", pensumDestinoId)
    .order("semestre");
  const asignaturas =
    (asignaturasRaw as { id: string; nombre: string; creditos: number; semestre: number }[] | null) ??
    [];

  // 2 y 3. Extraer materias del PDF y guardarlas. Si el certificado trae capa de texto, lo leemos
  // como texto; si está ESCANEADO (sin texto) y tenemos los bytes, lo leemos por VISIÓN (OCR). Si la
  // IA no responde en ninguno de los dos, extraer* lanza ErrorIANoDisponible y el pipeline se corta
  // (lo maneja quien invoca, para avisarle al usuario).
  const materias =
    textoPdf.trim().length >= MIN_TEXTO_LEGIBLE
      ? await extraerMateriasDeTexto(textoPdf)
      : bytesPdf
        ? await extraerMateriasPorVision(bytesPdf)
        : [];

  let idsMateria: string[] = [];
  if (materias.length > 0) {
    const filas = materias.map((m) => ({ caso_id: casoId, ...m }));
    // PostgREST devuelve las filas insertadas en el MISMO orden del arreglo de entrada, así que el
    // índice de cada materia sigue valiendo para mapear los vínculos que devuelve la IA.
    const { data: insertadas, error } = await supabase
      .from("materia_origen")
      .insert(filas)
      .select("id");
    if (error) throw error;
    idsMateria = ((insertadas as { id: string }[] | null) ?? []).map((r) => r.id);
  }

  // 4 y 5. Emparejar con IA y guardar los vínculos sugeridos.
  let semestreSugerido: number | null = null;
  if (idsMateria.length > 0 && asignaturas.length > 0) {
    const vinculos = await emparejarMaterias(
      materias.map((m) => ({ nombre: m.nombre, creditos: m.creditos, nota: m.nota })),
      asignaturas.map((a) => ({ nombre: a.nombre, creditos: a.creditos, semestre: a.semestre })),
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

    // Estimamos el semestre en código (no se lo dejamos a la IA): comparamos los créditos que el
    // estudiante alcanzó a homologar contra la carga promedio por semestre del plan.
    const idsHomologadas = new Set(filasVinculo.map((f) => f.asignatura_id));
    semestreSugerido = estimarSemestre(asignaturas, idsHomologadas);
  }

  // 6. Caso listo para revisión.
  const { error: errorUpdate } = await supabase
    .from("caso")
    .update({ estado: "en_revision", semestre_sugerido: semestreSugerido })
    .eq("id", casoId);
  if (errorUpdate) throw errorUpdate;
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
