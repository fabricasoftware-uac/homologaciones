"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { notificarVeredicto } from "@/lib/homologacion/correo";
import { extraerTextoPdf } from "@/lib/pdf/extraer";
import { procesarCaso } from "@/lib/homologacion/procesar";
import { ErrorIANoDisponible } from "@/lib/groq/cliente";

// Acciones de la revisión del admin. Corren con la sesión del admin: la RLS ("Solo admin gestiona
// vínculos" / "Solo admin actualiza casos") es la que de verdad autoriza la escritura.

const VEREDICTOS = ["aprobado", "rechazado"] as const;

// Vincula (o re-vincula) una materia de origen con una asignatura destino y la deja APROBADA. Es la
// acción central del estudio: el admin confirma una sugerencia de la IA o la corrige a mano. Como es
// una decisión del admin, la similitud queda en 100.
export async function vincular(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  const materiaOrigenId = String(formData.get("materiaOrigenId") ?? "");
  const asignaturaId = String(formData.get("asignaturaId") ?? "");
  const vinculoId = String(formData.get("vinculoId") ?? "");
  if (!casoId || !materiaOrigenId || !asignaturaId) return;

  const supabase = crearClienteServidor();
  if (vinculoId) {
    await supabase
      .from("vinculo")
      .update({ asignatura_id: asignaturaId, similitud: 100, estado: "aprobado" })
      .eq("id", vinculoId);
  } else {
    await supabase.from("vinculo").insert({
      caso_id: casoId,
      materia_origen_id: materiaOrigenId,
      asignatura_id: asignaturaId,
      similitud: 100,
      estado: "aprobado",
    });
  }
  revalidatePath(`/casos/${casoId}`);
}

// Aprueba de un golpe todas las sugerencias de la IA con similitud >= umbral que aún están
// pendientes en el caso. Acelera los casos grandes: el admin confirma en bloque lo de alta confianza
// y revisa a mano solo lo dudoso. Devuelve cuántas aprobó.
export async function confirmarSugerencias(formData: FormData): Promise<{ aprobadas: number }> {
  const casoId = String(formData.get("casoId") ?? "");
  const umbral = Number(formData.get("umbral"));
  if (!casoId || !Number.isFinite(umbral)) return { aprobadas: 0 };

  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("vinculo")
    .update({ estado: "aprobado" })
    .eq("caso_id", casoId)
    .eq("estado", "pendiente")
    .gte("similitud", umbral)
    .select("id");

  revalidatePath(`/casos/${casoId}`);
  return { aprobadas: (data as { id: string }[] | null)?.length ?? 0 };
}

// Quita la homologación de una materia (elimina el vínculo).
export async function desvincular(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  const vinculoId = String(formData.get("vinculoId") ?? "");
  if (!casoId || !vinculoId) return;

  const supabase = crearClienteServidor();
  await supabase.from("vinculo").delete().eq("id", vinculoId);
  revalidatePath(`/casos/${casoId}`);
}

// Cierra el caso con el veredicto final (aprobado/rechazado) y el semestre confirmado por el admin.
export async function finalizarCaso(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  const veredicto = String(formData.get("veredicto") ?? "");
  if (!casoId || !VEREDICTOS.includes(veredicto as (typeof VEREDICTOS)[number])) {
    return;
  }

  const semestre = Number(formData.get("semestre"));
  const semestreSugerido = Number.isInteger(semestre) && semestre > 0 ? semestre : null;
  const nota = String(formData.get("nota") ?? "").trim();
  const notaInterna = String(formData.get("notaInterna") ?? "").trim();

  const supabase = crearClienteServidor();
  // Auditoría: dejamos constancia de QUIÉN cerró el caso y CUÁNDO (decidido_por / decidido_en).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("caso")
    .update({
      estado: veredicto,
      semestre_sugerido: semestreSugerido,
      nota_admin: nota || null,
      nota_interna: notaInterna || null,
      decidido_en: new Date().toISOString(),
      decidido_por: user?.id ?? null,
    })
    .eq("id", casoId);

  // Avisamos al estudiante por correo. Es best-effort: el veredicto ya quedó guardado, así que si
  // el envío falla (o el caso es viejo y no dejó correo) solo lo registramos, sin romper la acción.
  try {
    await notificarVeredicto(crearClienteServicio(), {
      casoId,
      veredicto: veredicto as "aprobado" | "rechazado",
      semestre: semestreSugerido,
      nota: nota || null,
    });
  } catch (error) {
    console.error("[correo] No se pudo notificar al estudiante", casoId, error);
  }

  revalidatePath(`/casos/${casoId}`);
  revalidatePath("/casos");
}

// Reabre un caso ya cerrado para volver a editarlo en el estudio (vuelve a 'en_revision').
export async function reabrirCaso(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  if (!casoId) return;

  const supabase = crearClienteServidor();
  await supabase.from("caso").update({ estado: "en_revision" }).eq("id", casoId);

  revalidatePath(`/casos/${casoId}`);
  revalidatePath("/casos");
}

// Vuelve a correr el pipeline de IA sobre el caso. Sirve para los casos que quedaron atascados en
// 'procesando' (porque el procesamiento falló al enviar) o cuando se quiere regenerar la propuesta
// desde cero. Descarga el certificado del bucket, re-extrae el texto, BORRA las materias y vínculos
// previos (para no duplicar) y vuelve a procesar. Corre con el cliente de servicio porque escribe
// materia_origen/vínculos y lee un bucket privado. Devuelve un mensaje de error si no se puede.
export async function reprocesarCaso(formData: FormData): Promise<{ error: string } | void> {
  const casoId = String(formData.get("casoId") ?? "");
  if (!casoId) return { error: "Caso no válido." };

  const servicio = crearClienteServicio();

  const { data: caso } = await servicio
    .from("caso")
    .select("archivo_pdf")
    .eq("id", casoId)
    .single();
  const ruta = (caso as { archivo_pdf: string | null } | null)?.archivo_pdf ?? null;
  if (!ruta) {
    return { error: "Este caso no tiene un certificado en PDF para reprocesar." };
  }

  // Bajamos el PDF del bucket privado y re-extraemos su texto.
  const { data: blob, error: errorDescarga } = await servicio.storage
    .from("certificados")
    .download(ruta);
  if (errorDescarga || !blob) {
    return { error: "No pudimos descargar el certificado para reprocesarlo." };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let texto = "";
  try {
    texto = await extraerTextoPdf(bytes);
  } catch {
    return { error: "No pudimos leer el certificado para reprocesarlo." };
  }

  // Limpiamos la propuesta anterior: primero los vínculos (referencian materias) y luego las
  // materias. Dejamos el caso en 'procesando' mientras corre el pipeline.
  await servicio.from("vinculo").delete().eq("caso_id", casoId);
  await servicio.from("materia_origen").delete().eq("caso_id", casoId);
  await servicio
    .from("caso")
    .update({ estado: "procesando", semestre_sugerido: null })
    .eq("id", casoId);

  try {
    // Pasamos los bytes: si el certificado está escaneado, el pipeline lo lee por visión (OCR).
    await procesarCaso(casoId, texto, bytes);
  } catch (error) {
    console.error("[reprocesar] Falló el pipeline del caso", casoId, error);
    // No lo dejamos colgado en 'procesando': lo devolvemos a revisión manual antes de responder.
    await servicio.from("caso").update({ estado: "en_revision" }).eq("id", casoId);
    revalidatePath(`/casos/${casoId}`);
    if (error instanceof ErrorIANoDisponible) {
      return {
        error:
          "El servicio de IA no está disponible ahora mismo (posible falta de cupo o tokens). El caso quedó en revisión; vuelve a intentar el reprocesamiento en unos minutos.",
      };
    }
    return { error: "El reprocesamiento falló. Inténtalo de nuevo en un momento." };
  }

  revalidatePath(`/casos/${casoId}`);
  revalidatePath("/casos");
}

// Guarda (o limpia) las notas del caso sin cambiar su estado: la nota para el estudiante
// (nota_admin) y la nota interna del equipo (nota_interna, que nunca ve el estudiante ni el acta).
export async function guardarNota(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  if (!casoId) return;
  const nota = String(formData.get("nota") ?? "").trim();
  const notaInterna = String(formData.get("notaInterna") ?? "").trim();

  const supabase = crearClienteServidor();
  await supabase
    .from("caso")
    .update({ nota_admin: nota || null, nota_interna: notaInterna || null })
    .eq("id", casoId);

  revalidatePath(`/casos/${casoId}`);
}
