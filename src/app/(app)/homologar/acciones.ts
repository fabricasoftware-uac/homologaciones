"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { extraerTextoPdf } from "@/lib/pdf/extraer";
import { validarDocumentoAcademico } from "@/lib/groq/validar";
import { procesarCaso } from "@/lib/homologacion/procesar";
import { ErrorIANoDisponible } from "@/lib/groq/cliente";
import { notificarRecepcion } from "@/lib/homologacion/correo";
import { verificarTurnstile } from "@/lib/seguridad/turnstile";

// El resultado del envío para el formulario (useFormState):
//   - { error }             -> algo impidió registrar la solicitud; se muestra en rojo.
//   - { aviso, casoId }      -> la solicitud SÍ quedó registrada, pero el análisis automático de la
//                               IA no pudo correr (p. ej. sin cupo/tokens). Se avisa como info y el
//                               formulario lleva al estudiante a su caso.
//   - null                   -> éxito normal (redirige al detalle desde el servidor).
export type EstadoHomologacion =
  | { error: string }
  | { aviso: string; casoId: string }
  | null;

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB, igual que el tope del bucket
const LIMITE_DIARIO = 5; // homologaciones por día, contadas por IP y por invitado
const MIN_TEXTO_PDF = 30; // mínimo de caracteres para dar el PDF por legible

// Identificador de la IP del solicitante, HASHEADO (sha256): no guardamos la IP en claro, pero
// alcanza para contar cuántos envíos salieron de la misma IP.
function ipHasheada(): string {
  const cabeceras = headers();
  const cruda =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabeceras.get("x-real-ip") ||
    "desconocida";
  return createHash("sha256").update(cruda).digest("hex");
}

// Recibe la solicitud del estudiante (que entra como INVITADO, sin registrarse): valida los campos,
// frena el abuso con un tope diario, comprueba con IA que el PDF sea un documento académico real,
// sube el certificado y crea el caso en estado 'procesando'. El estudiante no arma ni elige vínculos:
// eso queda para el sistema/IA y el admin.
export async function crearHomologacion(
  _estadoPrevio: EstadoHomologacion,
  datos: FormData,
): Promise<EstadoHomologacion> {
  const pensumId = String(datos.get("pensum") ?? "");
  const institucion = String(datos.get("institucion") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const celular = String(datos.get("celular") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const autoriza = datos.get("autoriza") === "on";
  const archivo = datos.get("archivo");

  // --- 1. Validación básica de los campos ---
  if (!pensumId) {
    return { error: "Elige la carrera que quieres homologar." };
  }
  if (!institucion) {
    return { error: "Selecciona o escribe tu universidad de origen." };
  }
  // Datos de contacto: los tres son obligatorios (es como te avisamos el resultado).
  if (!nombre) {
    return { error: "Escribe tu nombre completo." };
  }
  if (!celular || celular.replace(/\D/g, "").length < 7) {
    return { error: "Escribe un número de celular válido para poder contactarte." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: "Escribe un correo electrónico válido para avisarte el resultado." };
  }
  // Habeas Data: sin autorización de tratamiento de datos no podemos procesar la solicitud.
  if (!autoriza) {
    return { error: "Debes autorizar el tratamiento de tus datos para enviar la solicitud." };
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

  // Captcha: primer filtro anti-bot, antes de gastar trabajo en validar, subir o consultar nada.
  const tokenCaptcha = String(datos.get("cf-turnstile-response") ?? "");
  if (!(await verificarTurnstile(tokenCaptcha))) {
    return {
      error: "No pudimos verificar que no eres un robot. Recarga la página e inténtalo de nuevo.",
    };
  }

  const supabase = crearClienteServidor();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // --- 2. Tope diario (por IP y por invitado). Va primero, antes de gastar trabajo en validar y
  // subir, y antes de crear la sesión anónima: así un abuso bloqueado no deja invitados huérfanos.
  // La función es security definer y cuenta por IP saltándose la RLS; el conteo por usuario usa
  // auth.uid() (0 si todavía no hay sesión, que es lo correcto para un invitado nuevo). ---
  const ip = ipHasheada();
  const { data: conteo } = await supabase.rpc("contar_homologaciones_recientes", {
    ip_param: ip,
  });
  const fila = (conteo as { por_ip?: number; por_usuario?: number } | null) ?? {};
  if (Number(fila.por_ip ?? 0) >= LIMITE_DIARIO || Number(fila.por_usuario ?? 0) >= LIMITE_DIARIO) {
    return {
      error: `Alcanzaste el límite de ${LIMITE_DIARIO} homologaciones por día. Inténtalo de nuevo mañana.`,
    };
  }

  // --- 3. Validación del contenido del PDF con IA: que sea un documento académico real y no
  // publicidad, contenido para adultos o spam. ---
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let texto = "";
  try {
    texto = await extraerTextoPdf(bytes);
  } catch {
    return { error: "No pudimos leer el PDF. Asegúrate de subir un archivo válido." };
  }
  // Si el PDF trae poca o ninguna capa de texto lo tratamos como ESCANEADO: ya NO lo rechazamos
  // (antes sí), el pipeline lo leerá por VISIÓN (OCR) más abajo. La validación anti-spam por texto
  // solo aplica cuando hay texto; para escaneados confiamos en la extracción por visión + la revisión
  // del admin (misma filosofía fail-open que validarDocumentoAcademico).
  const escaneado = texto.trim().length < MIN_TEXTO_PDF;
  if (!escaneado) {
    const veredicto = await validarDocumentoAcademico(texto);
    if (!veredicto.valido) {
      return {
        error:
          "El archivo no parece un certificado de notas válido. Sube tu historial académico o pensum oficial.",
      };
    }
  }

  // --- 4. Identidad: el estudiante no se registra. Si pasó los filtros y aún no tiene sesión, lo
  // volvemos invitado anónimo para asociarle el caso (y que luego pueda ver "Mis homologaciones"). ---
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      // Dejamos el motivo real en el log del servidor: el mensaje al usuario es genérico, pero si
      // esto falla suele ser config del stack (p. ej. enable_signup=false apaga también el anónimo).
      console.error("[homologar] Falló signInAnonymously", error);
      return { error: "No pudimos iniciar tu sesión de invitado. Inténtalo de nuevo." };
    }
    user = data.user;
  }

  // --- 5. Subir el certificado a la carpeta del usuario y registrar el caso. ---
  // La ruta empieza con su id porque la RLS del bucket lo exige; la marca de tiempo evita pisar
  // envíos anteriores.
  const ruta = `${user.id}/${Date.now()}.pdf`;
  const { error: errorSubida } = await supabase.storage
    .from("certificados")
    .upload(ruta, archivo, { contentType: "application/pdf" });
  if (errorSubida) {
    return { error: "No pudimos subir el archivo. Inténtalo de nuevo en un momento." };
  }

  const { data: casoNuevo, error: errorCaso } = await supabase
    .from("caso")
    .insert({
      estudiante_id: user.id,
      pensum_destino_id: pensumId,
      institucion_origen_nombre: institucion,
      solicitante_nombre: nombre,
      solicitante_celular: celular,
      solicitante_correo: correo,
      archivo_pdf: ruta,
      ip_solicitante: ip,
      // Constancia de la autorización de tratamiento de datos (Habeas Data).
      autorizo_datos: true,
      autorizo_en: new Date().toISOString(),
      // estado se queda en 'procesando' por defecto
    })
    .select("id")
    .single();
  if (errorCaso || !casoNuevo) {
    // Si no pudimos registrar el caso, borramos el PDF para no dejar archivos huérfanos.
    await supabase.storage.from("certificados").remove([ruta]);
    return { error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." };
  }

  // --- 6. Pipeline de IA (Fases 4 + 5): extraer materias, emparejar con el pensum destino y dejar
  // el caso listo para revisión. Reutilizamos el texto que ya extrajimos para validar. Es
  // resiliente: si el procesamiento falla, el caso queda en 'procesando' (se puede reprocesar) y
  // igual confirmamos el envío, porque la solicitud del estudiante SÍ quedó registrada. ---
  const idCaso = (casoNuevo as { id: string }).id;
  let iaNoDisponible = false;
  try {
    // Le pasamos también los bytes: si el certificado está escaneado, el pipeline lo lee por visión.
    await procesarCaso(idCaso, texto, bytes);
  } catch (error) {
    console.error("[pipeline] Falló el procesamiento del caso", idCaso, error);
    if (error instanceof ErrorIANoDisponible) {
      // El análisis automático no pudo correr (IA sin cupo/tokens o caída). La solicitud SÍ quedó
      // registrada: la sacamos de 'procesando' para que no se quede colgada en el detalle y la
      // dejamos en revisión manual. Le avisaremos al estudiante por sileo (más abajo).
      iaNoDisponible = true;
      await crearClienteServicio().from("caso").update({ estado: "en_revision" }).eq("id", idCaso);
    }
  }

  // Aviso persistente para la campana del admin (best-effort: si falla, no rompemos el envío). Lo
  // inserta el cliente de servicio porque solo el admin/sistema escribe en `notificacion`.
  try {
    await crearClienteServicio().from("notificacion").insert({
      tipo: "homologacion_nueva",
      titulo: "Nueva homologación recibida",
      cuerpo: `${nombre} · ${institucion}`,
      caso_id: idCaso,
    });
  } catch (error) {
    console.error("[notificacion] No se pudo crear el aviso", error);
  }

  // Documentos adicionales (contenidos programáticos / syllabi): opcionales y best-effort. Se suben
  // a la carpeta del estudiante (mismas policies del bucket) y se registran en documento_caso con el
  // cliente de servicio (como las demás tablas de dominio). Si alguno falla, no rompe el envío.
  const documentos = datos
    .getAll("documentos")
    .filter(
      (d): d is File =>
        d instanceof File && d.size > 0 && d.type === "application/pdf" && d.size <= TAMANO_MAXIMO,
    )
    .slice(0, 10); // tope defensivo
  if (documentos.length > 0) {
    const servicio = crearClienteServicio();
    for (const doc of documentos) {
      const rutaDoc = `${user.id}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error: errorDoc } = await supabase.storage
        .from("certificados")
        .upload(rutaDoc, doc, { contentType: "application/pdf" });
      if (errorDoc) {
        console.error("[documento] No se pudo subir un adjunto", errorDoc);
        continue;
      }
      const { error: errorFila } = await servicio.from("documento_caso").insert({
        caso_id: idCaso,
        tipo: "syllabus",
        ruta: rutaDoc,
        nombre_archivo: doc.name.slice(0, 200),
      });
      if (errorFila) console.error("[documento] No se pudo registrar un adjunto", errorFila);
    }
  }

  // Comprobante de recepción al estudiante (best-effort): confirma el envío y le deja el enlace de
  // seguimiento por si pierde la sesión. Si falla el correo, no rompemos el envío.
  try {
    await notificarRecepcion(crearClienteServicio(), { casoId: idCaso });
  } catch (error) {
    console.error("[correo] No se pudo enviar el comprobante de recepción", idCaso, error);
  }

  // Si la IA no estuvo disponible, NO redirigimos desde el servidor: devolvemos un aviso para que el
  // formulario se lo anuncie al estudiante por sileo (su solicitud quedó registrada y pasará a
  // revisión manual) y luego lo lleve a su caso. Los best-effort de arriba (correo de recepción,
  // aviso al admin) ya corrieron igual.
  if (iaNoDisponible) {
    return {
      aviso:
        "Recibimos tu solicitud y quedó registrada. El análisis automático no está disponible en este momento, así que un asesor la revisará manualmente y te avisará el resultado por correo.",
      casoId: idCaso,
    };
  }

  // Camino normal: lo llevamos directo al detalle de SU caso, donde ve la "posible homologación" (el
  // aproximado de la IA) en vez de un acuse genérico.
  redirect(`/mis-homologaciones/${idCaso}`);
}
