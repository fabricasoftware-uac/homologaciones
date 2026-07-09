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
  // horas: intensidad horaria original (competencias SENA); los créditos ya vienen convertidos ÷48.
  materia_origen: { nombre: string; creditos: number | null; horas: number | null } | null;
  asignatura: { nombre: string; semestre: number; creditos: number } | null;
};

// Fila cruda tal como la devuelve el select de vinculo con materia_origen embebida (nombre,
// creditos, tipo, metadatos). Deriva `horas` para las competencias SENA. La comparten
// /mis-homologaciones/[id] y /seguimiento/[token].
export type HomologacionFilaCruda = {
  id: string;
  materia_origen: {
    nombre: string;
    creditos: number | null;
    tipo: string | null;
    metadatos: Record<string, unknown> | null;
  } | null;
  asignatura: { nombre: string; semestre: number; creditos: number } | null;
};

export function aFilaHomologacion(cruda: HomologacionFilaCruda): HomologacionFila {
  const ih = Number(cruda.materia_origen?.metadatos?.intensidad_horaria);
  return {
    id: cruda.id,
    materia_origen: cruda.materia_origen
      ? {
          nombre: cruda.materia_origen.nombre,
          creditos: cruda.materia_origen.creditos,
          horas:
            cruda.materia_origen.tipo === "competencia" && Number.isFinite(ih) && ih > 0 ? ih : null,
        }
      : null,
    asignatura: cruda.asignatura,
  };
}

function ordinal(n: number) {
  return `${n}.º`;
}

// Agrupa las filas (una por vínculo) por materia de origen, conservando el orden de entrada: el
// grupo aparece donde aparecía su primera fila (las páginas ya ordenan por semestre destino) y sus
// asignaturas quedan en ese mismo orden.
type GrupoMateria = {
  nombre: string;
  creditos: number | null;
  horas: number | null;
  filas: HomologacionFila[];
};

function agruparPorMateria(homologadas: HomologacionFila[]): GrupoMateria[] {
  const grupos = new Map<string, GrupoMateria>();
  for (const h of homologadas) {
    // Sin materia de origen (borrada), la fila va sola: se agrupa por su propio id.
    const clave = h.materia_origen?.nombre ?? `sin-materia-${h.id}`;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.filas.push(h);
    } else {
      grupos.set(clave, {
        nombre: h.materia_origen?.nombre ?? "—",
        creditos: h.materia_origen?.creditos ?? null,
        horas: h.materia_origen?.horas ?? null,
        filas: [h],
      });
    }
  }
  return [...grupos.values()];
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
  // Horas de formación SENA (una competencia puede aparecer en varias filas si cubre varias
  // asignaturas: se cuenta una sola vez por nombre).
  const horasPorMateria = new Map<string, number>();
  for (const h of homologadas) {
    if (h.materia_origen?.horas) horasPorMateria.set(h.materia_origen.nombre, h.materia_origen.horas);
  }
  const horasFormacion = Array.from(horasPorMateria.values()).reduce((s, n) => s + n, 0);
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
                {horasFormacion > 0 && (
                  <span>
                    <strong className="text-slate-900 dark:text-slate-100">{horasFormacion}</strong>{" "}
                    horas de formación (≈ {Math.max(1, Math.round(horasFormacion / 48))} créditos)
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

          {/* Comparación origen -> Autónoma, AGRUPADA por materia de origen: una competencia SENA
              puede cubrir varias asignaturas y como lista plana (una fila por vínculo, ordenada por
              semestre destino) sus filas quedaban regadas y parecía relacionada con una sola. Aquí
              la materia va UNA vez a la izquierda y todas sus asignaturas apiladas a la derecha —
              lo mismo que ve el asesor en el estudio. */}
          {homologadas.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span className="truncate">Lo que cursaste</span>
                <span />
                <span className="truncate text-right">Te vale en la Autónoma</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {agruparPorMateria(homologadas).map((grupo) => (
                  <div
                    key={grupo.filas[0].id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block text-slate-500 dark:text-slate-400 line-clamp-2">
                        {grupo.nombre}
                      </span>
                      {grupo.horas != null && grupo.creditos != null && (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {grupo.horas} h ≈ {grupo.creditos} cr
                        </span>
                      )}
                      {grupo.filas.length > 1 && (
                        <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          Cubre {grupo.filas.length} asignaturas
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                        verde ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400"
                      }`}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 text-right space-y-1.5">
                      {grupo.filas.map((h) => (
                        <span key={h.id} className="block">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                            {h.asignatura?.nombre ?? "—"}
                          </span>
                          {h.asignatura && (
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                              {ordinal(h.asignatura.semestre)} semestre · {h.asignatura.creditos} cr
                            </span>
                          )}
                        </span>
                      ))}
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
