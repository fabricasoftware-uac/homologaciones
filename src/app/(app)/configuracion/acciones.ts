"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esHexValido } from "@/lib/marca/configuracion";
import { CLAVES_FONDO } from "@/lib/marca/fondos";
import { CLAVES_POSICION } from "@/lib/marca/notif";
import { CLAVES_TEMA_OSCURO } from "@/lib/marca/temas-oscuros";

// Guarda la personalización de marca (nombre, colores y logo). Solo el admin: la RLS de
// `configuracion` y del bucket 'marca' lo autorizan. Tras guardar, revalidamos el layout raíz para
// que los nuevos colores y el nombre se apliquen en toda la app de inmediato.

export type EstadoMarca = { error: string } | { ok: true } | null;

const LOGO_MAX = 2 * 1024 * 1024; // 2 MB como máximo
const TIPOS_LOGO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

// Luminancia percibida (0 negro, 1 blanco): la usamos para rechazar colores de notificación casi
// blancos, que se verían invisibles en el panel y el toast (fondo claro).
function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

export async function guardarConfiguracion(
  _previo: EstadoMarca,
  formData: FormData,
): Promise<EstadoMarca> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const eslogan = String(formData.get("eslogan") ?? "").trim();
  const primario = String(formData.get("color_primario") ?? "").trim();
  const acento = String(formData.get("color_acento") ?? "").trim();
  const colorEliminar = String(formData.get("color_eliminar") ?? "").trim();
  const fondoBruto = String(formData.get("fondo_login") ?? "marca");
  const fondoLogin = CLAVES_FONDO.includes(fondoBruto) ? fondoBruto : "marca";
  const notifColor = String(formData.get("notif_color") ?? "").trim();
  const posicionBruta = String(formData.get("notif_posicion") ?? "top-center");
  const notifPosicion = CLAVES_POSICION.includes(posicionBruta) ? posicionBruta : "top-center";
  const notaMinima = Number(formData.get("nota_minima"));
  // Paleta del modo oscuro: validamos la clave contra las conocidas (si llega algo raro, "pizarra").
  const temaBruto = String(formData.get("tema_oscuro") ?? "pizarra");
  const temaOscuro = CLAVES_TEMA_OSCURO.includes(temaBruto) ? temaBruto : "pizarra";
  const logo = formData.get("logo");
  const logoOscuro = formData.get("logo_oscuro");

  if (!nombre) return { error: "Escribe el nombre de la institución." };
  if (!Number.isFinite(notaMinima) || notaMinima < 0 || notaMinima > 5) {
    return { error: "La nota mínima debe estar entre 0 y 5." };
  }
  if (
    !esHexValido(primario) ||
    !esHexValido(acento) ||
    !esHexValido(notifColor) ||
    !esHexValido(colorEliminar)
  ) {
    return { error: "Los colores deben ser hexadecimales válidos (ej. #1e40af)." };
  }
  if (luminancia(notifColor) > 0.82) {
    return {
      error: "El color de notificación es demasiado claro y no se vería. Elige uno más oscuro.",
    };
  }

  const supabase = crearClienteServidor();
  const cambios: Record<string, unknown> = {
    nombre_institucion: nombre,
    eslogan,
    color_primario: primario,
    color_acento: acento,
    color_eliminar: colorEliminar,
    fondo_login: fondoLogin,
    notif_color: notifColor,
    notif_posicion: notifPosicion,
    nota_minima: notaMinima,
    tema_oscuro: temaOscuro,
    actualizado_en: new Date().toISOString(),
  };

  if (logo instanceof File && logo.size > 0) {
    const ext = TIPOS_LOGO[logo.type];
    if (!ext) return { error: "El logo debe ser PNG, JPG, SVG o WebP." };
    if (logo.size > LOGO_MAX) return { error: "El logo no puede pesar más de 2 MB." };

    const ruta = `logo-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const { error: errorLogo } = await supabase.storage
      .from("marca")
      .upload(ruta, bytes, { contentType: logo.type, upsert: true });
    if (errorLogo) return { error: "No pudimos subir el logo. Inténtalo de nuevo." };
    cambios.logo_path = ruta;
  }

  // Logo para el modo oscuro (versión clara/blanca). Mismo tratamiento que el logo normal; opcional.
  if (logoOscuro instanceof File && logoOscuro.size > 0) {
    const ext = TIPOS_LOGO[logoOscuro.type];
    if (!ext) return { error: "El logo para modo oscuro debe ser PNG, JPG, SVG o WebP." };
    if (logoOscuro.size > LOGO_MAX) return { error: "El logo para modo oscuro no puede pesar más de 2 MB." };

    const ruta = `logo-oscuro-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await logoOscuro.arrayBuffer());
    const { error: errorLogoOscuro } = await supabase.storage
      .from("marca")
      .upload(ruta, bytes, { contentType: logoOscuro.type, upsert: true });
    if (errorLogoOscuro) return { error: "No pudimos subir el logo para modo oscuro. Inténtalo de nuevo." };
    cambios.logo_oscuro_path = ruta;
  }

  const { error } = await supabase.from("configuracion").update(cambios).eq("id", 1);
  if (error) return { error: "No pudimos guardar los cambios. Inténtalo de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true };
}
