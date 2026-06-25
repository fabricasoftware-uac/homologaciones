import { Skeleton, CabeceraSkeleton } from "@/components/skeleton";

// Skeleton de "Mis homologaciones": lista de tarjetas que el estudiante ve mientras cargan sus casos.
export default function CargandoMisHomologaciones() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <CabeceraSkeleton />
      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5 flex-1">
                  <Skeleton className="h-5 w-56" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full shrink-0" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
