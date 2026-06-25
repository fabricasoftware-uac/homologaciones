"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { extraerTextoPdf } from "@/lib/pdf/extraer";
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
  const detalle = await regenerarAsignaturas(supabase, pensumId, bytes);

  revalidatePath("/carreras");
  return { ok: true, detalle };
}

// Extrae las asignaturas del PDF y regenera las del pensum, con cuidado de no destruir datos en uso
// ni dejar la carrera vacía si la extracción no da resultados. Devuelve un texto para el admin.
async function regenerarAsignaturas(
  supabase: ReturnType<typeof crearClienteServidor>,
  pensumId: string,
  bytes: Uint8Array,
): Promise<string> {
  // 1) Por TEXTO (PDFs con capa de texto, lo normal).
  let texto = "";
  try {
    texto = await extraerTextoPdf(bytes);
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

  if (asignaturas.length === 0) {
    return "El PDF se guardó, pero no pudimos detectar asignaturas (ni por texto ni leyendo la imagen).";
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
    return "El PDF se guardó, pero no pudimos reemplazar las asignaturas anteriores. Inténtalo de nuevo.";
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
    return "El PDF se guardó, pero hubo un problema al registrar las asignaturas extraídas.";
  }
  return `Se detectaron y cargaron ${filas.length} asignaturas del pensum${
    viaVision ? " (leídas de la imagen del PDF)" : ""
  }.`;
}

// Elimina el PDF del plan de una carrera (del bucket y de la tabla).
export async function eliminarPlanPdf(formData: FormData) {
  const pensumId = String(formData.get("pensumId") ?? "");
  const ruta = String(formData.get("ruta") ?? "");
  if (!pensumId) return;

  const supabase = crearClienteServidor();
  if (ruta) {
    await supabase.storage.from("planes").remove([ruta]);
  }
  await supabase.from("pensum").update({ archivo_pdf: null }).eq("id", pensumId);

  revalidatePath("/carreras");
}
