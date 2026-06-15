"use server";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoHomologacion = { error: string } | null;

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB, igual que el tope del bucket

// Recibe la solicitud del estudiante: valida los datos, sube el certificado a su carpeta en
// Storage y crea el caso en estado 'procesando'. El estudiante no arma ni elige vínculos: eso
// queda para el sistema/IA y el admin.
export async function crearHomologacion(
  _estadoPrevio: EstadoHomologacion,
  datos: FormData,
): Promise<EstadoHomologacion> {
  const pensumId = String(datos.get("pensum") ?? "");
  const institucion = String(datos.get("institucion") ?? "").trim();
  const archivo = datos.get("archivo");

  if (!pensumId) {
    return { error: "Elige la carrera que quieres homologar." };
  }
  if (!institucion) {
    return { error: "Escribe el nombre de tu universidad de origen." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Adjunta tu certificado de notas en PDF." };
  }
  if (archivo.type !== "application/pdf") {
    return { error: "El certificado debe ser un archivo PDF." };
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return { error: "El PDF no puede pesar más de 10 MB." };
  }

  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/ingresar");
  }

  // Guardamos el archivo dentro de la carpeta del propio usuario; la RLS del bucket exige que la
  // ruta empiece con su id. Usamos la marca de tiempo para no pisar envíos anteriores.
  const ruta = `${user.id}/${Date.now()}.pdf`;
  const { error: errorSubida } = await supabase.storage
    .from("certificados")
    .upload(ruta, archivo, { contentType: "application/pdf" });
  if (errorSubida) {
    return { error: "No pudimos subir el archivo. Inténtalo de nuevo en un momento." };
  }

  const { error: errorCaso } = await supabase.from("caso").insert({
    estudiante_id: user.id,
    pensum_destino_id: pensumId,
    institucion_origen_nombre: institucion,
    archivo_pdf: ruta,
    // estado se queda en 'procesando' por defecto
  });
  if (errorCaso) {
    // Si no pudimos registrar el caso, borramos el PDF para no dejar archivos huérfanos.
    await supabase.storage.from("certificados").remove([ruta]);
    return { error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." };
  }

  redirect("/homologar/enviado");
}
