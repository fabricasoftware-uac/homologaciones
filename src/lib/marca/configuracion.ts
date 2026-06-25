import { cache } from "react";

import { crearClienteServidor } from "@/lib/supabase/servidor";

// Configuración de marca (white-label): nombre, logo y colores de la institución. La leemos una vez
// por request (cache de React) porque la usan tanto el layout raíz (tokens de color + título) como
// el marco de la app (logo y nombre del sidebar).

export type Configuracion = {
  nombre: string;
  eslogan: string;
  logoUrl: string | null;
  // Versión clara/blanca del logo para el modo oscuro. Si es null, se usa logoUrl en ambos modos.
  logoOscuroUrl: string | null;
  colorPrimario: string;
  colorAcento: string;
  colorEliminar: string;
  fondoLogin: string;
  notifColor: string;
  notifPosicion: string;
  // Nota mínima de origen (escala 0–5) para considerar una materia apta para homologar. El estudio
  // avisa por debajo de este umbral; no bloquea.
  notaMinima: number;
  // Clave de la paleta del modo oscuro (ver lib/marca/temas-oscuros.ts).
  temaOscuro: string;
};

export const CONFIGURACION_DEFECTO: Configuracion = {
  nombre: "TransfoEdu",
  eslogan: "Sistema de homologaciones académicas",
  logoUrl: null,
  logoOscuroUrl: null,
  colorPrimario: "#1e40af",
  colorAcento: "#0ea5e9",
  colorEliminar: "#dc2626",
  fondoLogin: "marca",
  notifColor: "#2563eb",
  notifPosicion: "top-center",
  notaMinima: 3.0,
  temaOscuro: "pizarra",
};

export const obtenerConfiguracion = cache(async (): Promise<Configuracion> => {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("configuracion")
    .select(
      "nombre_institucion, eslogan, logo_path, logo_oscuro_path, color_primario, color_acento, color_eliminar, fondo_login, notif_color, notif_posicion, nota_minima, tema_oscuro",
    )
    .eq("id", 1)
    .maybeSingle();

  if (!data) return CONFIGURACION_DEFECTO;
  const fila = data as {
    nombre_institucion: string | null;
    eslogan: string | null;
    logo_path: string | null;
    logo_oscuro_path: string | null;
    color_primario: string | null;
    color_acento: string | null;
    color_eliminar: string | null;
    fondo_login: string | null;
    notif_color: string | null;
    notif_posicion: string | null;
    nota_minima: number | string | null;
    tema_oscuro: string | null;
  };

  let logoUrl: string | null = null;
  if (fila.logo_path) {
    const { data: pub } = supabase.storage.from("marca").getPublicUrl(fila.logo_path);
    // Le agregamos la fecha como query para esquivar la caché del navegador al reemplazar el logo.
    logoUrl = `${pub.publicUrl}?v=${Date.now()}`;
  }

  let logoOscuroUrl: string | null = null;
  if (fila.logo_oscuro_path) {
    const { data: pub } = supabase.storage.from("marca").getPublicUrl(fila.logo_oscuro_path);
    logoOscuroUrl = `${pub.publicUrl}?v=${Date.now()}`;
  }

  return {
    nombre: fila.nombre_institucion?.trim() || CONFIGURACION_DEFECTO.nombre,
    eslogan: fila.eslogan ?? CONFIGURACION_DEFECTO.eslogan,
    logoUrl,
    logoOscuroUrl,
    colorPrimario: esHexValido(fila.color_primario) ? fila.color_primario! : CONFIGURACION_DEFECTO.colorPrimario,
    colorAcento: esHexValido(fila.color_acento) ? fila.color_acento! : CONFIGURACION_DEFECTO.colorAcento,
    colorEliminar: esHexValido(fila.color_eliminar) ? fila.color_eliminar! : CONFIGURACION_DEFECTO.colorEliminar,
    fondoLogin: fila.fondo_login ?? CONFIGURACION_DEFECTO.fondoLogin,
    notifColor: esHexValido(fila.notif_color) ? fila.notif_color! : CONFIGURACION_DEFECTO.notifColor,
    notifPosicion: fila.notif_posicion ?? CONFIGURACION_DEFECTO.notifPosicion,
    // numeric llega como string desde PostgREST: lo normalizamos a número (0–5).
    notaMinima: Number.isFinite(Number(fila.nota_minima))
      ? Number(fila.nota_minima)
      : CONFIGURACION_DEFECTO.notaMinima,
    temaOscuro: fila.tema_oscuro ?? CONFIGURACION_DEFECTO.temaOscuro,
  };
});

// Variables CSS que el layout raíz inyecta en <body> para que toda la app tome el color de marca.
export function variablesDeMarca(cfg: Configuracion): Record<string, string> {
  return {
    "--marca": cfg.colorPrimario,
    "--marca-hover": oscurecer(cfg.colorPrimario, 0.14),
    "--marca-fg": contraste(cfg.colorPrimario),
    "--acento": cfg.colorAcento,
    "--eliminar": cfg.colorEliminar,
    "--eliminar-hover": oscurecer(cfg.colorEliminar, 0.14),
    "--eliminar-fg": contraste(cfg.colorEliminar),
  };
}

export function esHexValido(valor: string | null | undefined): boolean {
  return typeof valor === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(valor.trim());
}

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aDosDigitos(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

// Versión más oscura del color (para el estado :hover de los botones).
function oscurecer(hex: string, factor: number): string {
  const [r, g, b] = hexARgb(hex);
  return `#${aDosDigitos(r * (1 - factor))}${aDosDigitos(g * (1 - factor))}${aDosDigitos(b * (1 - factor))}`;
}

// Texto legible sobre el color (blanco u oscuro) según su luminancia.
function contraste(hex: string): string {
  const [r, g, b] = hexARgb(hex);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#0f172a" : "#ffffff";
}
