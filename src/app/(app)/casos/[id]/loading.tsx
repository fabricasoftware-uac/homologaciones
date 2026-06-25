import { Skeleton } from "@/components/skeleton";

// Skeleton del estudio de homologación: cabecera + barra de acciones + las dos columnas (origen y
// destino) con tarjetas. Se muestra mientras el servidor carga el caso, sus materias y vínculos.
export default function CargandoCaso() {
  return (
    <div className="h-[calc(100dvh-4rem)] md:h-dvh flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
        <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-72 max-w-[60%]" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full shrink-0" />
      </div>

      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg hidden sm:block" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
        {[0, 1].map((col) => (
          <div key={col} className={col === 1 ? "hidden md:flex flex-col" : "flex flex-col"}>
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex-1 p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
