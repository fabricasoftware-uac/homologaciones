import {
  IconClock as Clock,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  IconArrowRight as ArrowRight,
  IconInfoCircle as Info,
  IconDownload as Download,
} from "@tabler/icons-react";

import type { EstadoCaso } from "@/types";

// Vista de resultado de una homologación (solo lectura). La comparten el detalle del estudiante con
// sesión (/mis-homologaciones/[id]) y la página pública de seguimiento por token (/seguimiento/[token]).
// Muestra el estado, la estimación o el resultado final, la comparación origen->destino y la nota del
// equipo. Cuando el caso está aprobado y se pasa `actaHref`, ofrece descargar el acta en PDF.

export type HomologacionFila = {
  id: string;
  materia_origen: { nombre: string; creditos: number | null } | null;
  asignatura: { nombre: string; semestre: number; creditos: number } | null;
};

function ordinal(n: number) {
  return `${n}.º`;
}

export function ResultadoHomologacion({
  estado,
  semestre,
  notaAdmin,
  homologadas,
  actaHref,
}: {
  estado: EstadoCaso;
  semestre: number | null;
  notaAdmin: string | null;
  homologadas: HomologacionFila[];
  actaHref?: string | null;
}) {
  const aprobado = estado === "aprobado";
  const esPosible = estado === "en_revision";
  const creditos = homologadas.reduce((s, h) => s + (h.asignatura?.creditos ?? 0), 0);
  const verde = aprobado;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Aviso al INICIO y bien visible: en revisión esto es solo un estimado, no el resultado
          oficial. Va primero para que el estudiante no lo omita. */}
      {esPosible && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3.5 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong className="font-bold">Esto es una estimación, no tu homologación oficial.</strong>{" "}
            Un asesor de la Autónoma del Cauca revisará tu caso y te contactará para confirmar el
            resultado definitivo.
          </p>
        </div>
      )}

      {/* Procesando: todavía no hay estimación. */}
      {estado === "procesando" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 animate-spin" />
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Estamos analizando tu certificado</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
            En un momento verás aquí una estimación de lo que podrías homologar.
          </p>
        </div>
      )}

      {/* Rechazado. */}
      {estado === "rechazado" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
            <XCircle className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Tu solicitud no fue aprobada</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
            Si crees que es un error, puedes enviar una nueva solicitud con tu certificado oficial.
          </p>
        </div>
      )}

      {/* Estimación (en revisión) o resultado (aprobada). */}
      {(esPosible || aprobado) && (
        <>
          {/* Hero con el semestre destacado. */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-7 flex items-center gap-5">
              <div
                className={`shrink-0 w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center ${
                  verde
                    ? "bg-green-600 text-white dark:bg-green-500/20 dark:text-green-200"
                    : "bg-blue-600 text-white dark:bg-blue-500/20 dark:text-blue-200"
                }`}
              >
                {semestre != null ? (
                  <>
                    <span className="text-2xl font-extrabold leading-none">{semestre}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide mt-1 opacity-90">
                      Semestre
                    </span>
                  </>
                ) : (
                  <Clock className="w-7 h-7" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-bold uppercase tracking-wider ${
                    verde ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {verde ? "Homologación aprobada" : "Estimación preliminar"}
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {semestre != null
                    ? verde
                      ? `Quedas en ${ordinal(semestre)} semestre`
                      : `Podrías ingresar a ${ordinal(semestre)} semestre`
                    : verde
                      ? "Tu homologación fue aprobada"
                      : "Calculando tu semestre…"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {verde
                    ? "Estas son las materias que se te homologan."
                    : "Calculado con los créditos que ya cursaste."}
                </p>
              </div>
            </div>
            {homologadas.length > 0 && (
              <div className="px-5 sm:px-7 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                <span>
                  <strong className="text-slate-900 dark:text-slate-100">{homologadas.length}</strong>{" "}
                  {verde ? "materias homologadas" : "materias homologables"}
                </span>
                {creditos > 0 && (
                  <span>
                    <strong className="text-slate-900 dark:text-slate-100">{creditos}</strong> créditos
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Descargar el acta oficial (solo cuando está aprobada). */}
          {aprobado && actaHref && (
            <a
              href={actaHref}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-bold px-4 py-3 rounded-xl shadow-sm shadow-green-600/20 dark:shadow-none transition-colors"
            >
              <Download className="w-5 h-5" />
              Descargar acta de homologación (PDF)
            </a>
          )}

          {/* Comparación origen -> Autónoma. */}
          {homologadas.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span className="truncate">Lo que cursaste</span>
                <span />
                <span className="truncate text-right">Te vale en la Autónoma</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {homologadas.map((h) => (
                  <div
                    key={h.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 text-slate-500 dark:text-slate-400 truncate">
                      {h.materia_origen?.nombre ?? "—"}
                    </span>
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                        verde ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400"
                      }`}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 text-right">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                        {h.asignatura?.nombre ?? "—"}
                      </span>
                      {h.asignatura && (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {ordinal(h.asignatura.semestre)} semestre · {h.asignatura.creditos} cr
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* En revisión sin coincidencias todavía. */}
          {esPosible && homologadas.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Todavía no tenemos una estimación de materias. Un asesor revisará tu certificado y te
              contactará con el resultado.
            </div>
          )}
        </>
      )}

      {/* Nota del equipo. */}
      {notaAdmin && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Nota del equipo
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{notaAdmin}</p>
        </section>
      )}
    </div>
  );
}
