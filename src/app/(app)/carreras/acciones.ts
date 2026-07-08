"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { extraerTextoEstructurado } from "@/lib/pdf/extraer-estructurado";
import {
  extraerAsignaturasDePensum,
  extraerAsignaturasPorVision,
  type AsignaturaExtraida,
} from "@/lib/groq/extraer-pensum";

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
  // 1) Por TEXTO (PDFs con capa de texto, lo normal). El texto va RECONSTRUIDO en orden visual
  // (renglones y columnas por coordenadas): los pensums en cuadrícula llegaban revueltos a la IA y
  // perdía semestres enteros.
  let texto = "";
  try {
    const estructurado = await extraerTextoEstructurado(bytes);
    texto = estructurado.texto;
  } catch {
    texto = "";
  }

  let asignaturas: AsignaturaExtraida[] = [];
  if (texto.trim().length >= 30) {
    asignaturas = await extraerAsignaturasDePensum(texto);
  }

  // 2) Si el PDF no tiene texto (escaneo) o el texto no dio asignaturas, lo leemos por VISIÓN:
  // renderizamos las páginas a imagen y un modelo multimodal las interpreta (como un OCR con IA).
  let viaVision = false;
  if (asignaturas.length === 0) {
    try {
      asignaturas = await extraerAsignaturasPorVision(bytes);
      viaVision = asignaturas.length > 0;
    } catch (error) {
      console.error("[pensum] Falló la extracción por visión", error);
    }
  }

  const semestres = new Set(asignaturas.map((a) => a.semestre)).size;
  console.log(
    `[pensum] extracción${viaVision ? " por visión" : " por texto"}: ${asignaturas.length} asignaturas en ${semestres} semestres`,
  );

  if (asignaturas.length === 0) {
    return {
      ok: false,
      detalle:
        "No pudimos detectar asignaturas en el PDF (ni por texto ni leyendo la imagen). Se conservaron las asignaturas anteriores; revisa el archivo o crea las asignaturas manualmente.",
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
  return {
    ok: true,
    detalle: `Se cargaron ${filas.length} asignaturas en ${semestres} semestres${
      viaVision ? " (leídas de la imagen del PDF)" : ""
    }.`,
  };
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
