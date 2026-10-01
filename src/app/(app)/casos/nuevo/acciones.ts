"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { extraerTextoPdf, contarPaginasPdf } from "@/lib/pdf/extraer";
import { procesarCaso } from "@/lib/homologacion/procesar";
import { ErrorIANoDisponible } from "@/lib/openrouter/cliente";
import type { Rol } from "@/types";

export type EstadoCrearCaso =
  | { error: string }
  | { aviso: string; casoId: string }
  | null;

const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB por archivo

export async function crearCasoCoordinador(
  _estadoPrevio: EstadoCrearCaso,
  datos: FormData,
): Promise<EstadoCrearCaso> {
  const supabase = crearClienteServidor();

  // 1. Verificación de autenticación y rol de quien registra (staff: admin o asesor)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para registrar casos de homologación." };
  }

  const { data: perfilData } = await supabase
    .from("perfil")
    .select("rol, nombre")
    .eq("id", user.id)
    .single();

  const rol: Rol = (perfilData as { rol: Rol } | null)?.rol ?? "estudiante";
  if (rol !== "admin" && rol !== "asesor") {
    return { error: "No tienes permisos para registrar casos de homologación." };
  }

  // 2. Extracción de datos del formulario
  const nombre = String(datos.get("nombre") ?? "").trim();
  const cedula = String(datos.get("cedula") ?? "").trim();
  const lugarExpedicion = String(datos.get("lugar_expedicion") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const celular = String(datos.get("celular") ?? "").trim();

  const pensumId = String(datos.get("pensum") ?? "").trim();
  const institucion = String(datos.get("institucion") ?? "").trim();
  const programaOrigen = String(datos.get("programa_origen") ?? "").trim();

  const periodoMatricula = String(datos.get("periodo_matricula") ?? "").trim();
  const fechaLimitePago = String(datos.get("fecha_limite_pago") ?? "").trim();

  const archivo = datos.get("archivo");

  // Folios manuales opcionales si fueron especificados
  const foliosSolRaw = Number(datos.get("folios_solicitud"));
  const foliosSolicitud = Number.isInteger(foliosSolRaw) && foliosSolRaw > 0 ? foliosSolRaw : 1;

  // 3. Validación de campos obligatorios
  if (!nombre) {
    return { error: "El nombre completo del aspirante es obligatorio." };
  }
  if (!cedula) {
    return { error: "El número de documento de identidad (cédula) es obligatorio." };
  }
  if (!lugarExpedicion) {
    return { error: "El lugar de expedición del documento es obligatorio." };
  }
  if (!pensumId) {
    return { error: "Debes seleccionar la carrera destino de la Autónoma del Cauca." };
  }
  if (!institucion) {
    return { error: "Debes seleccionar o escribir la institución de origen." };
  }
  if (!programaOrigen) {
    return { error: "El programa o carrera de origen es obligatorio." };
  }

  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: "El correo electrónico tiene un formato inválido." };
  }

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Debes adjuntar el certificado de notas en formato PDF." };
  }
  if (archivo.type !== "application/pdf") {
    return { error: "El certificado de notas debe ser un archivo PDF válido." };
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return { error: "El certificado de notas no puede superar los 15 MB." };
  }

  // 4. Lectura de bytes y conteo de páginas del certificado
  const bytesCertificado = new Uint8Array(await archivo.arrayBuffer());
  let textoPdf = "";
  try {
    textoPdf = await extraerTextoPdf(bytesCertificado);
  } catch (err) {
    console.warn("[coordinador] No se pudo extraer texto puro del PDF, se procesará por visión", err);
  }

  const paginasCertificado = await contarPaginasPdf(bytesCertificado);
  const foliosCertificadoRaw = Number(datos.get("folios_certificado"));
  const foliosCertificado =
    Number.isInteger(foliosCertificadoRaw) && foliosCertificadoRaw > 0
      ? foliosCertificadoRaw
      : paginasCertificado > 0
        ? paginasCertificado
        : 1;

  // 5. Subida del certificado al storage
  const rutaCertificado = `${user.id}/${Date.now()}-cert.pdf`;
  const { error: errorSubidaCert } = await supabase.storage
    .from("certificados")
    .upload(rutaCertificado, archivo, { contentType: "application/pdf" });

  if (errorSubidaCert) {
    console.error("[coordinador] Error al subir certificado", errorSubidaCert);
    return { error: "No se pudo subir el archivo del certificado. Inténtalo de nuevo." };
  }

  // 6. Creación del caso en la base de datos
  const servicio = crearClienteServicio();
  const { data: casoNuevo, error: errorCaso } = await supabase
    .from("caso")
    .insert({
      estudiante_id: user.id, // Retrocompatibilidad con la FK existente
      creado_por_id: user.id, // Auditoría del coordinador que registró el caso
      asesor_id: rol === "asesor" ? user.id : null, // Si es asesor, queda asignado automáticamente
      pensum_destino_id: pensumId,
      institucion_origen_nombre: institucion,
      programa_origen_nombre: programaOrigen,
      solicitante_nombre: nombre,
      solicitante_cedula: cedula,
      solicitante_lugar_exp: lugarExpedicion,
      solicitante_correo: correo || null,
      solicitante_celular: celular || null,
      archivo_pdf: rutaCertificado,
      periodo_matricula: periodoMatricula || null,
      fecha_limite_pago: fechaLimitePago || null,
      folios_solicitud: foliosSolicitud,
      folios_certificado: foliosCertificado,
      estado: "procesando",
      autorizo_datos: true,
      autorizo_en: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (errorCaso || !casoNuevo) {
    console.error("[coordinador] Error al registrar caso", errorCaso);
    await supabase.storage.from("certificados").remove([rutaCertificado]);
    return { error: "No se pudo crear el caso en el sistema. Revisa los datos e intenta nuevamente." };
  }

  const idCaso = (casoNuevo as { id: string }).id;

  // 7. Subida y registro de contenidos programáticos adicionales (opcionales)
  const archivosDocs = datos
    .getAll("documentos")
    .filter(
      (d): d is File =>
        d instanceof File && d.size > 0 && d.type === "application/pdf" && d.size <= TAMANO_MAXIMO,
    )
    .slice(0, 10);

  let totalFoliosContenidos = 0;
  if (archivosDocs.length > 0) {
    for (const doc of archivosDocs) {
      const bytesDoc = new Uint8Array(await doc.arrayBuffer());
      const pgs = await contarPaginasPdf(bytesDoc);
      totalFoliosContenidos += pgs > 0 ? pgs : 1;

      const rutaDoc = `${user.id}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pdf`;
      const { error: errorDoc } = await supabase.storage
        .from("certificados")
        .upload(rutaDoc, doc, { contentType: "application/pdf" });

      if (errorDoc) {
        console.error("[coordinador] Error al subir syllabus", errorDoc);
        continue;
      }

      await servicio.from("documento_caso").insert({
        caso_id: idCaso,
        tipo: "syllabus",
        ruta: rutaDoc,
        nombre_archivo: doc.name.slice(0, 200),
      });
    }

    // Actualizar folios de contenidos programáticos
    if (totalFoliosContenidos > 0) {
      await servicio
        .from("caso")
        .update({ folios_contenidos: totalFoliosContenidos })
        .eq("id", idCaso);
    }
  }

  // 8. Notificación interna
  try {
    await servicio.from("notificacion").insert({
      tipo: "homologacion_nueva",
      titulo: "Nuevo caso registrado por coordinación",
      cuerpo: `${nombre} · ${institucion} (${programaOrigen})`,
      caso_id: idCaso,
    });
  } catch (errNotif) {
    console.warn("[coordinador] No se pudo crear notificación", errNotif);
  }

  // 9. Disparo del pipeline de IA para extraer y sugerir homologaciones
  let iaNoDisponible = false;
  try {
    await procesarCaso(idCaso, textoPdf, bytesCertificado);
  } catch (error) {
    console.error("[coordinador] Error en pipeline de IA", idCaso, error);
    if (error instanceof ErrorIANoDisponible) {
      iaNoDisponible = true;
      await servicio.from("caso").update({ estado: "en_revision" }).eq("id", idCaso);
    }
  }

  revalidatePath("/casos");

  if (iaNoDisponible) {
    return {
      aviso:
        "El caso fue registrado exitosamente. La IA no estuvo disponible para el análisis automático, por lo que las materias deberán revisarse manualmente.",
      casoId: idCaso,
    };
  }

  redirect(`/casos/${idCaso}`);
}
