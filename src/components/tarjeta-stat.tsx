import type { Icon as LucideIcon } from "@tabler/icons-react";
import clsx from "clsx";

// Tarjeta de métrica (KPI) con estilo premium: la etiqueta arriba, el número grande y el ícono en
// un chip pequeño a la derecha. Más sobria que el típico "bloque de color" de dashboard genérico.
// El acento "marca" usa el color de la institución; los demás son semánticos (estado del caso).
const TINTE: Record<string, string> = {
  marca: "bg-marca/10 text-marca",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  green: "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  red: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export function TarjetaStat({
  icono: Icono,
  titulo,
  valor,
  acento = "slate",
  delayMs = 0,
}: {
  icono: LucideIcon;
  titulo: string;
  valor: number | string;
  acento?: "marca" | "amber" | "green" | "red" | "slate";
  delayMs?: number;
}) {
  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition-shadow hover:shadow-md dark:hover:shadow-slate-950/50 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* El rótulo en versalitas espaciadas: son cifras de un tablero, y el rótulo debe leerse como
            encabezado de columna, no competir con el número. */}
        <p className="etiqueta-registro pt-1">{titulo}</p>
        <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TINTE[acento])}>
          <Icono className="w-[18px] h-[18px]" />
        </div>
      </div>
      {/* tabular-nums: sin esto, las cifras bailan de ancho al actualizarse y la fila de tarjetas
          "tiembla" cuando cambian los datos. */}
      <p className="text-[2.1rem] leading-none font-bold text-slate-900 dark:text-slate-100 mt-4 tracking-[-0.02em] tabular-nums">
        {valor}
      </p>
    </div>
  );
}
