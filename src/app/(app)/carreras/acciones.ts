"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import {
  extraerAsignaturasDePensum,
  extraerAsignaturasPorVision,
  extraccionSospechosa,
  type AsignaturaExtraida,
} from "@/lib/ia/extraer-pensum";
import { parsearPensum } from "@/lib/extraccion/pensum-parser";

// Gestión del PDF del plan de estudios de cada carrera (solo admin; la RLS del bucket 'planes' y de
// la tabla pensum lo autorizan).

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB, igual que el tope del bucket

export type EstadoPlan = { error: string } | { ok: true; detalle: string } | null;

// Sube (o reemplaza) el PDF del plan de una carrera. Guardamos un único archivo por carrera en
// {pensumId}.pdf y con upsert para que reemplazar pise el anterior.
export async function subirPlanPdf(
  _previo: EstadoPlan,
  formData: FormData,
): Promise<EstadoPlan> {
  const pensumId = String(formData.get("pensumId") ?? "");
  const archivo = formData.get("archivo");

  if (!pensumId) return { error: "Carrera no válida." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Adjunta un PDF." };
  if (archivo.type !== "application/pdf") return { error: "El plan debe ser un archivo PDF." };
  if (archivo.size > TAMANO_MAXIMO) return { error: "El PDF no puede pesar más de 10 MB." };

  const supabase = crearClienteServidor();
  const ruta = `${pensumId}.pdf`;
  const bytes = new Uint8Array(await archivo.arrayBuffer());

  const { error: errorSubida } = await supabase.storage
    .from("planes")
    .upload(ruta, bytes, { contentType: "application/pdf", upsert: true });
  if (errorSubida) {
    return { error: "No pudimos subir el PDF. Inténtalo de nuevo." };
  }

  const { error: errorUpdate } = await supabase
    .from("pensum")
    .update({ archivo_pdf: ruta })
    .eq("id", pensumId);
  if (errorUpdate) {
    return { error: "No pudimos guardar el plan." };
  }

  // Flujo clave: el PDF que sube el admin DEFINE el pensum. Extraemos sus asignaturas con IA y las
  // dejamos en la tabla `asignatura`, que es contra lo que se empareja al homologar. Sin esto, una
  // carrera sin asignaturas sembradas "no relaciona" nada (antes solo Ing. de Software las tenía).
  const resultado = await regenerarAsignaturas(supabase, pensumId, bytes);

  revalidatePath("/carreras");
  // Si la extracción falló, el admin debe enterarse YA (antes se devolvía ok con un texto tibio y el
  // pensum viejo quedaba cargado en silencio, como si el nuevo PDF hubiera funcionado).
  if (!resultado.ok) return { error: resultado.detalle };
  return { ok: true, detalle: resultado.detalle };
}

// Extrae las asignaturas del PDF y regenera las del pensum, con cuidado de no destruir datos en uso
// ni dejar la carrera vacía si la extracción no da resultados. Devuelve un texto para el admin.
async function regenerarAsignaturas(
  supabase: ReturnType<typeof crearClienteServidor>,
  pensumId: string,
  bytes: Uint8Array,
): Promise<{ ok: boolean; detalle: string }> {
  // 1) Parser determinístico posicional (0 tokens) para el formato institucional en cuadrícula.
  //    SE AUTO-VALIDA: si el layout no calza o su salida huele a basura, devuelve [] y seguimos.
  let asignaturas: AsignaturaExtraida[] = [];
  try {
    asignaturas = await parsearPensum(bytes);
  } catch (error) {
    console.error("[pensum] Falló el parser determinístico, probando IA:", error);
  }

  // 2) Fallback: IA sobre el texto reconstruido en orden visual. Su salida también se revisa: con
  // capas de texto fantasma o columnas intercaladas el modelo emite el plan DUPLICADO corrido de
  // semestre; eso se descarta y se prueba visión, que lee la IMAGEN y no sufre esos artefactos.
  if (asignaturas.length === 0) {
    try {
      asignaturas = await extraerAsignaturasDePensum(bytes);
      if (asignaturas.length > 0 && extraccionSospechosa(asignaturas)) {
        console.warn("[pensum] La extracción por texto salió sospechosa (nombres repetidos entre semestres); probando visión.");
        asignaturas = [];
      }
    } catch (error) {
      console.error("[pensum] Falló la extracción por IA:", error);
    }
  }

  // 3) Si el PDF no tiene texto (escaneo) o el texto no dio asignaturas confiables, lo leemos por
  // VISIÓN: renderizamos las páginas a imagen y un modelo multimodal las interpreta (OCR con IA).
  let viaVision = false;
  if (asignaturas.length === 0) {
    try {
      asignaturas = await extraerAsignaturasPorVision(bytes);
      if (asignaturas.length > 0 && extraccionSospechosa(asignaturas)) {
        console.warn("[pensum] La extracción por visión también salió sospechosa; se descarta.");
        asignaturas = [];
      }
      viaVision = asignaturas.length > 0;
    } catch (error) {
      console.error("[pensum] Falló la extracción por visión", error);
    }
  }

  if (asignaturas.length === 0) {
    return {
      ok: false,
      detalle:
        "No pudimos leer las asignaturas del PDF con confianza (ni por texto ni leyendo la imagen). Se conservaron las asignaturas anteriores; revisa el archivo o crea las asignaturas manualmente.",
    };
  }

  // Reemplazamos las asignaturas del pensum por las del nuevo PDF. Primero quitamos los vínculos que
  // apuntaban a las asignaturas anteriores: son homologaciones hechas contra el plan viejo, que
  // dejan de valer al cambiar el pensum, y además su FK impediría borrar las asignaturas. Así el
  // reemplazo SIEMPRE funciona (antes se bloqueaba y el pensum equivocado se quedaba pegado).
  const { data: viejas } = await supabase.from("asignatura").select("id").eq("pensum_id", pensumId);
  const idsViejas = ((viejas as { id: string }[] | null) ?? []).map((r) => r.id);
  if (idsViejas.length > 0) {
    await supabase.from("vinculo").delete().in("asignatura_id", idsViejas);
  }
  const { error: errorBorrado } = await supabase.from("asignatura").delete().eq("pensum_id", pensumId);
  if (errorBorrado) {
    return {
      ok: false,
      detalle: "El PDF se guardó, pero no pudimos reemplazar las asignaturas anteriores. Inténtalo de nuevo.",
    };
  }

  // La tabla exige código único por pensum (varios null sí se permiten): de-duplicamos códigos.
  const vistos = new Set<string>();
  const filas = asignaturas.map((a) => {
    let codigo = a.codigo;
    if (codigo) {
      if (vistos.has(codigo)) codigo = null;
      else vistos.add(codigo);
    }
    return { pensum_id: pensumId, nombre: a.nombre, codigo, creditos: a.creditos, semestre: a.semestre };
  });

  const { error: errorInsert } = await supabase.from("asignatura").insert(filas);
  if (errorInsert) {
    return {
      ok: false,
      detalle: "El PDF se guardó, pero hubo un problema al registrar las asignaturas extraídas.",
    };
  }
  const semestres = new Set(asignaturas.map((a) => a.semestre)).size;
  return {
    ok: true,
    detalle: `Se cargaron ${filas.length} asignaturas en ${semestres} semestres${
      viaVision ? " (leídas de la imagen del PDF)" : ""
    }.`,
  };
}

// ── Gestión de carreras (el catálogo de pensums) ──
// El admin tiene control total del catálogo: crear una carrera nueva, renombrarla (si la institución
// le cambia el nombre) o eliminarla. La RLS "Solo admin gestiona pensums" autoriza con su sesión.

export async function crearCarrera(formData: FormData): Promise<{ error: string } | void> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Escribe el nombre de la carrera." };
  // La tabla exige version NOT NULL (el año/etiqueta del plan de estudios). Si el admin no la
  // indica, va el año actual — omitirla rompía el insert entero y el toast solo decía "no se pudo".
  const version = String(formData.get("version") ?? "").trim() || String(new Date().getFullYear());

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("pensum").insert({ carrera: nombre, version });
  if (error) {
    console.error("[carreras] crearCarrera falló:", error);
    return {
      error: error.code === "23505" ? "Ya existe una carrera con ese nombre." : "No se pudo crear la carrera.",
    };
  }
  revalidatePath("/carreras");
  revalidatePath("/homologar"); // el estudiante elige carrera allí
}

export async function renombrarCarrera(formData: FormData): Promise<{ error: string } | void> {
  const pensumId = String(formData.get("pensumId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!pensumId) return { error: "Carrera no válida." };
  if (!nombre) return { error: "Escribe el nombre de la carrera." };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("pensum").update({ carrera: nombre }).eq("id", pensumId);
  if (error) {
    console.error("[carreras] renombrarCarrera falló:", error);
    return {
      error: error.code === "23505" ? "Ya existe una carrera con ese nombre." : "No se pudo renombrar la carrera.",
    };
  }
  revalidatePath("/carreras");
  revalidatePath("/homologar");
}

// Elimina una carrera completa: su pensum, sus asignaturas (con los vínculos que las referencian),
// el caché de decisiones y el PDF del plan. Se BLOQUEA si hay casos apuntando a la carrera: esos
// estudios (abiertos o cerrados) perderían su destino; primero hay que resolverlos o borrarlos.
export async function eliminarCarrera(formData: FormData): Promise<{ error: string } | void> {
  const pensumId = String(formData.get("pensumId") ?? "");
  if (!pensumId) return { error: "Carrera no válida." };

  const supabase = crearClienteServidor();

  const { count } = await supabase
    .from("caso")
    .select("id", { count: "exact", head: true })
    .eq("pensum_destino_id", pensumId);
  if ((count ?? 0) > 0) {
    return {
      error: `No se puede eliminar: ${count} caso${count === 1 ? " usa" : "s usan"} esta carrera. Elimina o reasigna esos casos primero.`,
    };
  }

  // Orden por FKs: vínculos → decisiones cacheadas → asignaturas → PDF del bucket → pensum.
  const { data: asigs } = await supabase.from("asignatura").select("id").eq("pensum_id", pensumId);
  const idsAsigs = ((asigs as { id: string }[] | null) ?? []).map((r) => r.id);
  if (idsAsigs.length > 0) {
    await supabase.from("vinculo").delete().in("asignatura_id", idsAsigs);
  }

  // decision_matching es tabla interna SIN policies: con la sesión, el delete no borra nada (en
  // silencio) y el delete del pensum choca con su FK. Va con el cliente de SERVICIO, re-chequeando
  // a mano que quien llama sea admin (el cliente de servicio se salta toda la RLS).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfil").select("rol").eq("id", user.id).single()
    : { data: null };
  if ((perfil as { rol?: string } | null)?.rol !== "admin") return { error: "No autorizado." };
  await crearClienteServicio().from("decision_matching").delete().eq("pensum_id", pensumId);

  await supabase.from("asignatura").delete().eq("pensum_id", pensumId);

  const { data: fila } = await supabase.from("pensum").select("archivo_pdf").eq("id", pensumId).single();
  const ruta = (fila as { archivo_pdf: string | null } | null)?.archivo_pdf;
  if (ruta) {
    await supabase.storage.from("planes").remove([ruta]);
  }

  const { error } = await supabase.from("pensum").delete().eq("id", pensumId);
  if (error) {
    console.error("[carreras] eliminarCarrera falló:", error);
    return { error: "No se pudo eliminar la carrera." };
  }

  revalidatePath("/carreras");
  revalidatePath("/homologar");
}

// ── Gestión manual de asignaturas del pensum ──
// La extracción automática puede fallar u omitir: el admin puede AGREGAR una asignatura que faltó,
// EDITAR una extraída (nombre/código/créditos/semestre) o ELIMINARLA. Es la red de seguridad sin IA.
// La RLS "Solo admin gestiona asignaturas" autoriza estas escrituras con la sesión del admin.

// Entero opcional de un formulario: "" o inválido → null.
function aEnteroPositivo(valor: FormDataEntryValue | null): number | null {
  const n = Number(String(valor ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Créditos: entero >= 0 (la tabla lo exige no-null; si no viene, 0).
function aCreditosForm(valor: FormDataEntryValue | null): number {
  const n = Number(String(valor ?? "").trim());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function agregarAsignatura(formData: FormData): Promise<{ error: string } | void> {
  const pensumId = String(formData.get("pensumId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const semestre = aEnteroPositivo(formData.get("semestre"));
  if (!pensumId) return { error: "Carrera no válida." };
  if (!nombre) return { error: "El nombre de la asignatura es obligatorio." };
  if (semestre === null) return { error: "El semestre debe ser un número mayor que cero." };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("asignatura").insert({
    pensum_id: pensumId,
    nombre,
    codigo: String(formData.get("codigo") ?? "").trim() || null,
    creditos: aCreditosForm(formData.get("creditos")),
    semestre,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe una asignatura con ese código en este pensum." : "No se pudo agregar la asignatura.",
    };
  }
  revalidatePath("/carreras");
}

export async function editarAsignatura(formData: FormData): Promise<{ error: string } | void> {
  const asignaturaId = String(formData.get("asignaturaId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const semestre = aEnteroPositivo(formData.get("semestre"));
  if (!asignaturaId) return { error: "Asignatura no válida." };
  if (!nombre) return { error: "El nombre de la asignatura es obligatorio." };
  if (semestre === null) return { error: "El semestre debe ser un número mayor que cero." };

  const supabase = crearClienteServidor();
  const { error } = await supabase
    .from("asignatura")
    .update({
      nombre,
      codigo: String(formData.get("codigo") ?? "").trim() || null,
      creditos: aCreditosForm(formData.get("creditos")),
      semestre,
      // El embedding describe el nombre anterior: se anula y el backfill perezoso del pipeline lo
      // regenera en el próximo caso (asegurarEmbeddingsAsignaturas).
      embedding: null,
    })
    .eq("id", asignaturaId);
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe una asignatura con ese código en este pensum." : "No se pudo guardar la asignatura.",
    };
  }
  revalidatePath("/carreras");
}

export async function eliminarAsignatura(formData: FormData): Promise<{ error: string } | void> {
  const asignaturaId = String(formData.get("asignaturaId") ?? "");
  if (!asignaturaId) return { error: "Asignatura no válida." };

  const supabase = crearClienteServidor();
  // Primero sus vínculos (FK sin cascada): homologaciones hechas contra esta asignatura dejan de valer.
  await supabase.from("vinculo").delete().eq("asignatura_id", asignaturaId);
  const { error } = await supabase.from("asignatura").delete().eq("id", asignaturaId);
  if (error) return { error: "No se pudo eliminar la asignatura." };
  revalidatePath("/carreras");
}

// Elimina el PDF del plan de una carrera junto con sus asignaturas: el PDF DEFINE el pensum, así que
// quitarlo deja la carrera sin plan (antes las asignaturas quedaban "pegadas" y parecía que el pensum
// viejo seguía cargado). Los vínculos que apuntaban a esas asignaturas se borran primero (FK).
export async function eliminarPlanPdf(formData: FormData) {
  const pensumId = String(formData.get("pensumId") ?? "");
  const ruta = String(formData.get("ruta") ?? "");
  if (!pensumId) return;

  const supabase = crearClienteServidor();
  if (ruta) {
    await supabase.storage.from("planes").remove([ruta]);
  }
  await supabase.from("pensum").update({ archivo_pdf: null }).eq("id", pensumId);

  const { data: viejas } = await supabase.from("asignatura").select("id").eq("pensum_id", pensumId);
  const idsViejas = ((viejas as { id: string }[] | null) ?? []).map((r) => r.id);
  if (idsViejas.length > 0) {
    await supabase.from("vinculo").delete().in("asignatura_id", idsViejas);
  }
  await supabase.from("asignatura").delete().eq("pensum_id", pensumId);

  revalidatePath("/carreras");
}