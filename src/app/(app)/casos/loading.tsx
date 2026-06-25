import { Skeleton, CabeceraSkeleton } from "@/components/skeleton";

// Skeleton de la bandeja de casos: se muestra mientras el servidor consulta los casos. Imita el
// layout real (tarjetas de stats + pestañas + tabla) para que no haya salto al cargar.
export default function CargandoCasos() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <CabeceraSkeleton />
      <main className="p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-7">
          <div className="grid grid-cols-1 @xl:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[100px] rounded-2xl" />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-10 w-full max-w-md rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-32 hidden sm:block" />
                <Skeleton className="h-4 w-20 hidden md:block" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
