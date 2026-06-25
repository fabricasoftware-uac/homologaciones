// Paletas predefinidas para el MODO OSCURO. La institución elige una desde el panel; se guarda solo
// la CLAVE. Cada paleta define las cuatro superficies del tema oscuro:
//   - fondo: el fondo de página (lo más oscuro)
//   - superficie: tarjetas, sidebar, popovers
//   - muted: chips, inputs, fondos sutiles
//   - borde: bordes y divisores
//
// El layout raíz inyecta estos valores en runtime (sobre la clase .dark), así que cambiar de paleta
// recolorea todo el modo oscuro sin tocar el modo claro.

// Cada paleta define las superficies sólidas (tarjetas, bordes…) y un `gradiente` SUTIL para el
// fondo de página — mismo espíritu que el degradado del login, pero atenuado para que sirva de
// interfaz (las tarjetas flotan encima con su color sólido). Dirección 160° como el login.
export const TEMAS_OSCUROS = [
  { clave: "pizarra", nombre: "Pizarra", fondo: "#020617", superficie: "#0f172a", muted: "#1e293b", borde: "#1e293b", gradiente: "linear-gradient(160deg, #020617 0%, #0e1a33 48%, #020617 100%)" },
  { clave: "medianoche", nombre: "Medianoche", fondo: "#0a0f20", superficie: "#0f1830", muted: "#1e293f", borde: "#24304d", gradiente: "linear-gradient(160deg, #0a0f20 0%, #16264f 48%, #0a0f20 100%)" },
  { clave: "indigo", nombre: "Índigo", fondo: "#0b0a1f", superficie: "#16132e", muted: "#231f45", borde: "#2c2752", gradiente: "linear-gradient(160deg, #0b0a1f 0%, #241d4b 48%, #0b0a1f 100%)" },
  { clave: "carbon", nombre: "Carbón", fondo: "#0a0a0a", superficie: "#171717", muted: "#262626", borde: "#2a2a2a", gradiente: "linear-gradient(160deg, #0a0a0a 0%, #1c1c1c 48%, #0a0a0a 100%)" },
  { clave: "zinc", nombre: "Zinc", fondo: "#09090b", superficie: "#18181b", muted: "#27272a", borde: "#2a2a2e", gradiente: "linear-gradient(160deg, #09090b 0%, #1d1d20 48%, #09090b 100%)" },
] as const;

export type TemaOscuro = (typeof TEMAS_OSCUROS)[number];
export type ClaveTemaOscuro = TemaOscuro["clave"];

export const CLAVES_TEMA_OSCURO: string[] = TEMAS_OSCUROS.map((t) => t.clave);

export function temaOscuroDe(clave: string): TemaOscuro {
  return TEMAS_OSCUROS.find((t) => t.clave === clave) ?? TEMAS_OSCUROS[0];
}

// CSS que recolorea el modo oscuro según la paleta elegida. Setea los tokens (.dark) para los
// componentes que los usan, y además sobre-escribe las utilidades slate literales (incluidas las
// variantes dark:) con un selector de mayor especificidad, sin !important.
export function cssTemaOscuro(clave: string): string {
  const t = temaOscuroDe(clave);
  return [
    `.dark{`,
    `--background:${t.fondo};--card:${t.superficie};--popover:${t.superficie};`,
    `--border:${t.borde};--input:${t.muted};--muted:${t.muted};--secondary:${t.muted};--accent:${t.muted};`,
    `--sidebar:${t.superficie};--sidebar-border:${t.borde};--sidebar-accent:${t.muted};`,
    `}`,
    // Fondo de página = degradado sutil (estilo login). Sin background-attachment:fixed para que cada
    // superficie contenga su propio degradado de forma consistente (no trozos distintos del viewport).
    `html.dark body,html.dark [class~="bg-slate-950"],html.dark [class~="dark:bg-slate-950"]{background:${t.gradiente};}`,
    `html.dark [class~="bg-slate-900"],html.dark [class~="dark:bg-slate-900"]{background-color:${t.superficie};}`,
    // Superficies translúcidas (header con backdrop-blur, cabeceras de tabla, columnas): seguimos la
    // paleta pero conservando la opacidad con color-mix, para no perder el efecto vidrio.
    `html.dark [class~="bg-slate-900/85"],html.dark [class~="dark:bg-slate-900/85"]{background-color:color-mix(in srgb, ${t.superficie} 85%, transparent);}`,
    `html.dark [class~="bg-slate-900/50"],html.dark [class~="dark:bg-slate-900/50"]{background-color:color-mix(in srgb, ${t.superficie} 50%, transparent);}`,
    `html.dark [class~="bg-slate-900/40"],html.dark [class~="dark:bg-slate-900/40"]{background-color:color-mix(in srgb, ${t.superficie} 40%, transparent);}`,
    `html.dark [class~="bg-slate-800"],html.dark [class~="dark:bg-slate-800"]{background-color:${t.muted};}`,
    `html.dark [class~="border-slate-800"],html.dark [class~="dark:border-slate-800"]{border-color:${t.borde};}`,
    `html.dark [class~="divide-slate-800"]>*{border-color:${t.borde};}`,
  ].join("");
}
