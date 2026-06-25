import clsx from "clsx";

// Placeholder de carga con efecto SHIMMER (un brillo que barre de izquierda a derecha), más vivo que
// el típico pulse. Base gris que toma el tono del tema; el brillo se atenúa en oscuro. El movimiento
// usa el @keyframes shimmer de theme.css.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-md bg-slate-200/80 dark:bg-slate-800/70",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
        style={{ animation: "shimmer 1.6s infinite" }}
      />
    </div>
  );
}

// Encabezado-skeleton: imita el EncabezadoPagina (ícono + título + descripción) para que la cabecera
// no "salte" al cargar. Lo usan los loading.tsx de cada ruta.
export function CabeceraSkeleton() {
  return (
    <div className="bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <Skeleton className="hidden sm:block w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-64 max-w-[70%]" />
        </div>
      </div>
    </div>
  );
}
