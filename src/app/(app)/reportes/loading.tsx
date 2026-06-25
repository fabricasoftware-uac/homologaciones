import { Skeleton, CabeceraSkeleton } from "@/components/skeleton";

// Skeleton de los reportes (KPIs + paneles de gráficas).
export default function CargandoReportes() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <CabeceraSkeleton />
      <main className="p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-7">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-2xl" />
            ))}
          </div>

          <Panel altura="h-[210px]" />

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            <Panel altura="h-[200px]" />
            <Panel altura="h-[200px]" />
          </div>
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
            <Panel altura="h-[200px]" />
            <Panel altura="h-[200px]" />
          </div>
        </div>
      </main>
    </div>
  );
}

function Panel({ altura }: { altura: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className={`w-full ${altura} rounded-xl`} />
    </div>
  );
}
