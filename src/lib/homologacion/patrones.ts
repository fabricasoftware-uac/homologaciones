import { crearClienteServicio } from "@/lib/supabase/servicio";
import { normalizarNombre } from "./motor";

// ── Aprendizaje por PATRONES ──
//
// El caché de decisiones (decision_matching, Fase 7) solo acierta con texto IDÉNTICO: su clave es el
// sha256 del texto completo de la unidad (nombre + todos los resultados de aprendizaje). Con que una
// constancia traiga un RA redactado distinto, el hash cambia y la decisión que el asesor ya tomó se
// pierde.
//
// Este módulo aprende un nivel más arriba: cuenta cuántas veces los asesores han CONFIRMADO o
// RECHAZADO cada par (nombre de origen normalizado → asignatura destino). Cuando un par se repite
// lo suficiente, deja de ser una coincidencia y pasa a ser una regla del programa: el motor lo
// aplica solo, sin gastar IA.
//
// Todo aquí es BEST-EFFORT: si falla, el motor sigue por los niveles normales. Aprender es una
// mejora, nunca un requisito para procesar un caso.

type Supa = ReturnType<typeof crearClienteServicio>;

// Confirmaciones necesarias para que un patrón se aplique solo. Con 3 ya no es casualidad: tres
// asesores (o el mismo, en tres casos distintos) tomaron la misma decisión. Bajarlo a 2 dispara
// falsos positivos con programas de pocos casos; subirlo a 5 hace que el sistema tarde demasiado
// en aprender algo útil.
const MIN_CONFIRMACIONES = 3;

// Similitud con la que se propone un vínculo aprendido cuando no hay promedio histórico.
const SIMILITUD_PATRON = 90;

export type PatronAprendido = {
  asignaturaId: string;
  similitud: number;
  razon: string;
};

// Lee, en UNA sola consulta, los patrones ya aprendidos para una lista de nombres de origen contra
// un pensum. Devuelve solo los que superan el umbral y tienen más confirmaciones que rechazos.
//
// La clave del Map es el nombre YA normalizado; quien llama normaliza con la misma función.
export async function buscarPatrones(
  supabase: Supa,
  pensumId: string,
  nombresNormalizados: string[],
): Promise<Map<string, PatronAprendido[]>> {
  const resultado = new Map<string, PatronAprendido[]>();
  const unicos = [...new Set(nombresNormalizados)].filter((n) => n.length > 0);
  if (unicos.length === 0) return resultado;

  try {
    const { data, error } = await supabase
      .from("patron_homologacion")
      .select("nombre_origen_norm, asignatura_id, veces_confirmado, veces_rechazado, similitud_promedio")
      .eq("pensum_id", pensumId)
      .in("nombre_origen_norm", unicos)
      .gte("veces_confirmado", MIN_CONFIRMACIONES);
    if (error) throw error;

    const filas =
      (data as
        | {
            nombre_origen_norm: string;
            asignatura_id: string;
            veces_confirmado: number;
            veces_rechazado: number;
            similitud_promedio: number | null;
          }[]
        | null) ?? [];

    for (const fila of filas) {
      // El asesor se corrige: un par confirmado 3 veces pero rechazado 5 NO es un patrón válido.
      if (fila.veces_rechazado >= fila.veces_confirmado) continue;

      const lista = resultado.get(fila.nombre_origen_norm) ?? [];
      lista.push({
        asignaturaId: fila.asignatura_id,
        similitud: fila.similitud_promedio ?? SIMILITUD_PATRON,
        razon: `Aprendido: los asesores han confirmado esta equivalencia ${fila.veces_confirmado} veces`,
      });
      resultado.set(fila.nombre_origen_norm, lista);
    }
  } catch (e) {
    console.warn("[patrones] No se pudieron leer los patrones aprendidos; sigo sin ellos:", e);
  }

  return resultado;
}

// Resuelve (nombre normalizado de la materia, pensum del caso) para una materia de origen. Lo usan
// tanto el registro por materia como el de un rechazo puntual.
async function contexto(
  servicio: Supa,
  materiaOrigenId: string,
): Promise<{ nombreNorm: string; pensumId: string } | null> {
  const { data: mat } = await servicio
    .from("materia_origen")
    .select("nombre, caso_id")
    .eq("id", materiaOrigenId)
    .maybeSingle();
  if (!mat) return null;
  const fila = mat as { nombre: string; caso_id: string };

  const nombreNorm = normalizarNombre(fila.nombre);
  if (!nombreNorm) return null;

  const { data: casoRow } = await servicio
    .from("caso")
    .select("pensum_destino_id")
    .eq("id", fila.caso_id)
    .maybeSingle();
  const pensumId = (casoRow as { pensum_destino_id: string } | null)?.pensum_destino_id;
  if (!pensumId) return null;

  return { nombreNorm, pensumId };
}

// Registra un RECHAZO explícito de un par. Hace falta como función aparte porque `desvincular`
// BORRA la fila de vinculo: si esperáramos a leer el estado después del delete, el par simplemente
// no existiría y el sistema nunca aprendería que el asesor lo descartó. Se llama ANTES de borrar.
export async function registrarRechazoPatron(
  materiaOrigenId: string,
  asignaturaId: string,
): Promise<void> {
  try {
    const servicio = crearClienteServicio();
    const ctx = await contexto(servicio, materiaOrigenId);
    if (!ctx) return;

    await servicio.rpc("registrar_patron_homologacion", {
      p_nombre_norm: ctx.nombreNorm,
      p_pensum_id: ctx.pensumId,
      p_asignatura_id: asignaturaId,
      p_confirmado: false,
      p_similitud: null,
    });
  } catch (e) {
    console.warn("[patrones] No se pudo registrar el rechazo del asesor:", e);
  }
}

// Registra lo que el asesor decidió sobre UNA materia de origen: sus vínculos aprobados suman
// confirmación; los que había propuesto la IA y el asesor NO dejó aprobados suman rechazo.
//
// Se llama después de cada acción del estudio (vincular / desvincular / confirmar sugerencias),
// junto a actualizarDecisionAdmin. Best-effort: nunca lanza.
export async function registrarPatronesAdmin(materiaOrigenId: string): Promise<void> {
  try {
    const servicio = crearClienteServicio();
    const ctx = await contexto(servicio, materiaOrigenId);
    if (!ctx) return;

    // TODOS los vínculos de la materia, con su estado: los aprobados enseñan qué SÍ homologa; los
    // rechazados (o los que quedaron pendientes tras una revisión) enseñan qué NO. Aprender solo de
    // los positivos haría que un par propuesto por la IA una y otra vez, y descartado siempre por el
    // asesor, nunca acumulara evidencia en contra.
    const { data: vincs } = await servicio
      .from("vinculo")
      .select("asignatura_id, similitud, estado")
      .eq("materia_origen_id", materiaOrigenId);

    const lista =
      (vincs as { asignatura_id: string; similitud: number; estado: string }[] | null) ?? [];
    if (lista.length === 0) return;

    for (const v of lista) {
      const confirmado = v.estado === "aprobado";
      // Los 'pendiente' no enseñan nada todavía: el asesor aún no se pronunció sobre ellos.
      if (!confirmado && v.estado === "pendiente") continue;

      await servicio.rpc("registrar_patron_homologacion", {
        p_nombre_norm: ctx.nombreNorm,
        p_pensum_id: ctx.pensumId,
        p_asignatura_id: v.asignatura_id,
        p_confirmado: confirmado,
        p_similitud: confirmado ? Math.round(v.similitud) : null,
      });
    }

    const aprobados = lista.filter((v) => v.estado === "aprobado").length;
    console.log(
      `[patrones] Registrada la decisión del asesor sobre "${ctx.nombreNorm.slice(0, 60)}": ${aprobados} confirmación(es).`,
    );
  } catch (e) {
    console.warn("[patrones] No se pudo registrar el patrón del asesor:", e);
  }
}
