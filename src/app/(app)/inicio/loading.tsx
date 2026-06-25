import { Skeleton, CabeceraSkeleton } from "@/components/skeleton";

// Skeleton del panel de inicio (KPIs + cola de pendientes + decididos + accesos rápidos).
export default function CargandoInicio() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <CabeceraSkeleton />
      <main className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-7">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-2xl" />
            ))}
          </div>

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            {[0, 1].map((p) => (
              <div
                key={p}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-3.5 w-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[116px] rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
