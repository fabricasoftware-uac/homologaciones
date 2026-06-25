import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Notificación por correo del resultado de una homologación. Arma el mensaje y lo envía. Lee el
// contacto con el cliente de SERVICIO porque el correo del invitado no es visible con la RLS normal.
//
// Transporte según el entorno:
//   - DESARROLLO: lo manda al buzón local de Supabase (Mailpit, SMTP 127.0.0.1:54325). Así se puede
//     probar con CUALQUIER destinatario sin verificar dominio; los correos se ven en
//     http://127.0.0.1:54324. (Resend, en modo prueba, solo entrega al correo de la propia cuenta.)
//   - PRODUCCIÓN: usa Resend (API con plan gratuito). Requiere RESEND_API_KEY y un dominio verificado
//     en Resend para poder escribir a cualquier estudiante.
//
// Filosofía: best-effort. Si el estudiante no dejó correo (casos viejos) no envía nada. Solo lanza
// si el envío falla, para que quien llama lo registre (el veredicto ya quedó guardado igual).

type Veredicto = "aprobado" | "rechazado";

type Args = {
  casoId: string;
  veredicto: Veredicto;
  semestre: number | null;
  nota: string | null;
};

export async function notificarVeredicto(
  supabase: SupabaseClient,
  { casoId, veredicto, semestre, nota }: Args,
): Promise<void> {
  const { data, error } = await supabase
    .from("caso")
    .select("solicitante_nombre, solicitante_correo, token_seguimiento, pensum:pensum_destino_id (carrera)")
    .eq("id", casoId)
    .single();
  if (error || !data) throw error ?? new Error(`Caso ${casoId} no encontrado`);

  const fila = data as unknown as {
    solicitante_nombre: string | null;
    solicitante_correo: string | null;
    token_seguimiento: string;
    pensum: { carrera: string } | null;
  };
  const correo = fila.solicitante_correo;
  if (!correo) return; // caso anterior a la captura de contacto: no hay a quién escribirle

  const nombre = fila.solicitante_nombre?.trim() || "estudiante";
  const carrera = fila.pensum?.carrera ?? "el programa solicitado";
  const aprobado = veredicto === "aprobado";

  // Enlace de seguimiento (sin sesión) para que el estudiante vuelva a su caso y, si fue aprobado,
  // descargue el acta. Usa la URL pública del sitio; en desarrollo cae a localhost.
  const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const enlaceSeguimiento = `${sitio}/seguimiento/${fila.token_seguimiento}`;

  const asunto = aprobado
    ? "Tu homologación fue aprobada"
    : "Resultado de tu solicitud de homologación";
  const html = construirHtml({ nombre, carrera, aprobado, semestre, nota, enlaceSeguimiento });

  if (process.env.NODE_ENV === "production") {
    await enviarConResend(correo, asunto, html);
  } else {
    await enviarPorMailpit(correo, asunto, html);
  }
}

// Comprobante de recepción: se envía apenas el estudiante manda la solicitud. Confirma que la
// recibimos y le deja el enlace de seguimiento (por si pierde la sesión anónima). Best-effort, con
// la misma filosofía que notificarVeredicto.
export async function notificarRecepcion(
  supabase: SupabaseClient,
  { casoId }: { casoId: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("caso")
    .select("solicitante_nombre, solicitante_correo, token_seguimiento, pensum:pensum_destino_id (carrera)")
    .eq("id", casoId)
    .single();
  if (error || !data) throw error ?? new Error(`Caso ${casoId} no encontrado`);

  const fila = data as unknown as {
    solicitante_nombre: string | null;
    solicitante_correo: string | null;
    token_seguimiento: string;
    pensum: { carrera: string } | null;
  };
  const correo = fila.solicitante_correo;
  if (!correo) return;

  const nombre = fila.solicitante_nombre?.trim() || "estudiante";
  const carrera = fila.pensum?.carrera ?? "el programa solicitado";
  const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const enlace = `${sitio}/seguimiento/${fila.token_seguimiento}`;

  const asunto = "Recibimos tu solicitud de homologación";
  const html = construirHtmlRecepcion({ nombre, carrera, enlace });

  if (process.env.NODE_ENV === "production") {
    await enviarConResend(correo, asunto, html);
  } else {
    await enviarPorMailpit(correo, asunto, html);
  }
}

// PRODUCCIÓN: Resend. Sin clave configurada no envía (no-op) para no romper el flujo si falta el
// secreto; con clave, requiere un dominio verificado para escribir a cualquier destinatario.
async function enviarConResend(para: string, asunto: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE ?? "Homologaciones <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[correo] Sin RESEND_API_KEY: no se envía (no-op).", { para, asunto });
    return;
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: remitente, to: para, subject: asunto, html }),
  });

  if (!respuesta.ok) {
    throw new Error(`Resend respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
}

// DESARROLLO: buzón local de Supabase (Mailpit). No hay autenticación ni TLS; cualquier remitente y
// destinatario sirven. Los correos se ven en la interfaz web de Mailpit (http://127.0.0.1:54324).
async function enviarPorMailpit(para: string, asunto: string, html: string): Promise<void> {
  const transporte = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 54325, // [inbucket] smtp_port en supabase/config.toml
    secure: false,
    ignoreTLS: true,
  });
  await transporte.sendMail({
    from: process.env.CORREO_REMITENTE ?? "Homologaciones <no-reply@homologaciones.local>",
    to: para,
    subject: asunto,
    html,
  });
}

// Correo de comprobante de recepción (al enviar la solicitud).
function construirHtmlRecepcion({
  nombre,
  carrera,
  enlace,
}: {
  nombre: string;
  carrera: string;
  enlace: string;
}): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="height:5px;background:#2563eb;"></div>
      <div style="padding:28px 32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Recibimos tu solicitud</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Hola ${escaparHtml(nombre)},</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          Tu solicitud de homologación para <strong>${escaparHtml(carrera)}</strong> quedó registrada.
          La estamos analizando y te avisaremos el resultado por este medio.
        </p>
        <div style="margin-top:24px;text-align:center;">
          <a href="${enlace}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:10px;">
            Seguir el estado de mi solicitud
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
          Guarda este correo: el enlace te permite volver a tu solicitud aunque cierres el navegador.
        </p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#94a3b8;">
        Corporación Universitaria Autónoma del Cauca · Homologaciones
      </div>
    </div>
  </body>
</html>`;
}

// Escapa el contenido que viene de personas (nombre, nota, carrera) antes de meterlo en el HTML.
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function construirHtml({
  nombre,
  carrera,
  aprobado,
  semestre,
  nota,
  enlaceSeguimiento,
}: {
  nombre: string;
  carrera: string;
  aprobado: boolean;
  semestre: number | null;
  nota: string | null;
  enlaceSeguimiento: string;
}): string {
  const titulo = aprobado ? "¡Tu homologación fue aprobada!" : "Resultado de tu homologación";
  const acento = aprobado ? "#16a34a" : "#dc2626";
  const intro = aprobado
    ? `Revisamos tu solicitud de homologación para <strong>${escaparHtml(carrera)}</strong> y fue <strong>aprobada</strong>.`
    : `Revisamos tu solicitud de homologación para <strong>${escaparHtml(carrera)}</strong>. En esta ocasión <strong>no fue aprobada</strong>.`;

  const semestreBloque =
    aprobado && semestre != null
      ? `<p style="margin:16px 0 0;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#166534;font-size:15px;">Quedarías en el <strong>semestre ${semestre}</strong>.</p>`
      : "";

  const notaBloque = nota
    ? `<div style="margin-top:20px;"><p style="margin:0 0 6px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">Nota del equipo</p><div style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;color:#78350f;font-size:14px;line-height:1.5;">${escaparHtml(
        nota,
      ).replace(/\n/g, "<br>")}</div></div>`
    : "";

  // Botón de seguimiento: lleva al estudiante a su caso (sin tener que iniciar sesión). Cuando fue
  // aprobado, desde ahí descarga el acta en PDF.
  const textoBoton = aprobado ? "Ver mi resultado y descargar el acta" : "Ver el detalle de mi solicitud";
  const botonBloque = `<div style="margin-top:24px;text-align:center;"><a href="${enlaceSeguimiento}" style="display:inline-block;background:${acento};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:10px;">${textoBoton}</a></div>`;

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="height:5px;background:${acento};"></div>
      <div style="padding:28px 32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${titulo}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Hola ${escaparHtml(
          nombre,
        )},</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#334155;">${intro}</p>
        ${semestreBloque}
        ${notaBloque}
        ${botonBloque}
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#64748b;">
          Si tienes dudas, responde este correo y un asesor te ayudará a continuar con tu proceso.
        </p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#94a3b8;">
        Corporación Universitaria Autónoma del Cauca · Homologaciones
      </div>
    </div>
  </body>
</html>`;
}
