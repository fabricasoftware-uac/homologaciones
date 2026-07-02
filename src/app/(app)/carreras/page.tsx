import {
  IconBook as BookOpen,
  IconFileCheck as FileCheck2,
  IconChevronDown as ChevronDown,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import { GestorPlanPdf } from "./gestor-plan";

// Planes académicos (admin): tarjetas con las carreras de la Autónoma del Cauca, su pensum
// (asignaturas por semestre) y la gestión del PDF del plan (subir / ver / reemplazar / eliminar).

// Subir el pensum en PDF dispara la extracción con IA (y OCR por visión si está escaneado), que puede
// esperar varios segundos ante rate-limits de Groq. Sin esto, Vercel corta la función a los ~10s.
export const maxDuration = 60;

type AsignaturaRef = { nombre: string; creditos: number; semestre: number };
type PensumCard = {
  id: string;
  carrera: string;
  archivo_pdf: string | null;
  asignatura: AsignaturaRef[];
};

export default async function PaginaCarreras() {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("pensum")
    .select("id, carrera, archivo_pdf, asignatura (nombre, creditos, semestre)")
    .order("carrera");

  const pensums = (data ?? []) as unknown as PensumCard[];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Planes académicos"
        descripcion="Carreras de la Autónoma del Cauca: su pensum y el PDF oficial del plan."
        icono={BookOpen}
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 @3xl:grid-cols-2 gap-5">
          {pensums.map((pensum, i) => {
            const asignaturas = pensum.asignatura ?? [];
            const creditos = asignaturas.reduce((suma, a) => suma + a.creditos, 0);
            const semestres = Array.from(new Set(asignaturas.map((a) => a.semestre))).sort(
              (a, b) => a - b,
            );
            const url = pensum.archivo_pdf
              ? supabase.storage.from("planes").getPublicUrl(pensum.archivo_pdf).data.publicUrl
              : null;

            return (
              <div
                key={pensum.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-marca/10 text-marca rounded-xl shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{pensum.carrera}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {asignaturas.length > 0
                        ? `${asignaturas.length} asignaturas · ${creditos} créditos`
                        : "Plan no cargado aún"}
                    </p>
                  </div>
                  {url && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 px-2 py-1 rounded-full shrink-0">
                      <FileCheck2 className="w-3.5 h-3.5" /> PDF
                    </span>
                  )}
                </div>

                {asignaturas.length > 0 && (
                  <details className="group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <summary className="flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer list-none bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Ver pensum
                      <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="p-4 space-y-4 max-h-72 overflow-auto">
                      {semestres.map((sem) => (
                        <div key={sem}>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                            Semestre {sem}
                          </h3>
                          <ul className="space-y-1">
                            {asignaturas
                              .filter((a) => a.semestre === sem)
                              .map((a, i) => (
                                <li
                                  key={`${sem}-${i}`}
                                  className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 py-0.5"
                                >
                                  <span>{a.nombre}</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">{a.creditos} cr</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                  <GestorPlanPdf pensumId={pensum.id} ruta={pensum.archivo_pdf} url={url} />
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
