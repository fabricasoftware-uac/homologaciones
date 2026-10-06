"use client";

import { useState, useTransition, useMemo } from "react";
import {
  IconDeviceFloppy,
  IconPlus,
  IconX,
  IconRotate,
  IconChevronUp,
  IconChevronDown,
  IconAlertCircle,
  IconCheck,
  IconSparkles,
  IconBook,
} from "@tabler/icons-react";
import clsx from "clsx";
import { sileo } from "sileo";

import { guardarCursosMatricula } from "./acciones";

export type AsignaturaMatriculaItem = {
  id: string;
  codigo: string | null;
  nombre: string;
  semestre: number;
  creditos: number;
};

export type EditorCursosMatriculaProps = {
  casoId: string;
  cursosIniciales: AsignaturaMatriculaItem[];
  sugerenciaAutomatica: AsignaturaMatriculaItem[];
  todasAsignaturas: AsignaturaMatriculaItem[];
  deshabilitado?: boolean;
  inicialmenteGuardado?: boolean;
};

export function EditorCursosMatricula({
  casoId,
  cursosIniciales,
  sugerenciaAutomatica,
  todasAsignaturas,
  deshabilitado = false,
  inicialmenteGuardado = false,
}: EditorCursosMatriculaProps) {
  const [cursos, setCursos] = useState<AsignaturaMatriculaItem[]>(() =>
    cursosIniciales.length > 0 ? cursosIniciales : sugerenciaAutomatica,
  );
  const [asignaturaSeleccionadaId, setAsignaturaSeleccionadaId] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [esGuardado, setEsGuardado] = useState(inicialmenteGuardado);
  const [haCambiado, setHaCambiado] = useState(false);

  // Conjunto de IDs actualmente incluidos para filtrar el selector
  const idsSeleccionados = useMemo(() => new Set(cursos.map((c) => c.id)), [cursos]);

  // Asignaturas disponibles del pensum que aún no están en la lista
  const asignaturasDisponibles = useMemo(() => {
    return todasAsignaturas.filter((a) => !idsSeleccionados.has(a.id));
  }, [todasAsignaturas, idsSeleccionados]);

  // Agrupadas por semestre para el selector <optgroup>
  const asignaturasPorSemestre = useMemo(() => {
    const mapa = new Map<number, AsignaturaMatriculaItem[]>();
    for (const asig of asignaturasDisponibles) {
      const s = asig.semestre || 1;
      const arr = mapa.get(s) ?? [];
      arr.push(asig);
      mapa.set(s, arr);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a - b);
  }, [asignaturasDisponibles]);

  // Totales
  const totalCreditos = useMemo(
    () => cursos.reduce((acc, c) => acc + (c.creditos || 0), 0),
    [cursos],
  );

  function moverArriba(index: number) {
    if (index <= 0 || deshabilitado) return;
    setCursos((prev) => {
      const copia = [...prev];
      const temp = copia[index - 1];
      copia[index - 1] = copia[index];
      copia[index] = temp;
      return copia;
    });
    setHaCambiado(true);
  }

  function moverAbajo(index: number) {
    if (index >= cursos.length - 1 || deshabilitado) return;
    setCursos((prev) => {
      const copia = [...prev];
      const temp = copia[index + 1];
      copia[index + 1] = copia[index];
      copia[index] = temp;
      return copia;
    });
    setHaCambiado(true);
  }

  function eliminar(index: number) {
    if (deshabilitado) return;
    setCursos((prev) => prev.filter((_, i) => i !== index));
    setHaCambiado(true);
  }

  function agregarAsignatura() {
    if (!asignaturaSeleccionadaId || deshabilitado) return;
    const item = todasAsignaturas.find((a) => a.id === asignaturaSeleccionadaId);
    if (!item) return;

    setCursos((prev) => [...prev, item]);
    setAsignaturaSeleccionadaId("");
    setHaCambiado(true);
  }

  function restablecerSugerencia() {
    if (deshabilitado) return;
    setCursos(sugerenciaAutomatica);
    setHaCambiado(true);
    sileo.info?.({ title: "Sugerencia restablecida", description: "Se cargó la proyección académica recomendada." }) ??
      sileo.success({ title: "Sugerencia restablecida" });
  }

  function guardar() {
    if (deshabilitado) return;
    iniciar(async () => {
      const ids = cursos.map((c) => c.id);
      const res = await guardarCursosMatricula(casoId, ids);
      if (res?.error) {
        sileo.error({ title: "Error al guardar", description: res.error });
      } else {
        setEsGuardado(true);
        setHaCambiado(false);
        sileo.success({
          title: "Cursos de matrícula guardados",
          description: "Se reflejarán en el Artículo 3° de la Resolución.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Encabezado descriptivo y métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Cursos a Matricular (Artículo 3°)
            </h4>
            <span
              className={clsx(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                esGuardado && !haCambiado
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
              )}
            >
              {esGuardado && !haCambiado ? (
                <>
                  <IconCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Confirmado
                </>
              ) : (
                <>
                  <IconSparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {haCambiado ? "Modificado sin guardar" : "Proyección sugerida"}
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Asignaturas que el aspirante debe cursar en su período de ingreso.
          </p>
        </div>

        {/* Resumen de créditos y materias */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg">
            {cursos.length} {cursos.length === 1 ? "materia" : "materias"}
          </span>
          <span className="text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/20 px-2.5 py-1 rounded-lg">
            {totalCreditos} créditos
          </span>
        </div>
      </div>

      {/* Lista de asignaturas */}
      {cursos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
          <IconAlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            No hay asignaturas seleccionadas para la matrícula. Puedes restablecer la proyección automática inteligente del sistema.
          </p>
          {!deshabilitado && (
            <button
              type="button"
              onClick={restablecerSugerencia}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3.5 py-2 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <IconRotate className="w-3.5 h-3.5" />
              Cargar proyección académica
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-xs">
          {cursos.map((c, index) => (
            <div
              key={`${c.id}-${index}`}
              className="p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
            >
              {/* Información de la materia */}
              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                {/* Badge de orden correlativo */}
                <span className="shrink-0 w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-200/80 dark:border-slate-700/60 mt-0.5 sm:mt-0">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug break-words">
                      {c.nombre}
                    </span>
                    {c.codigo && (
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                        ({c.codigo})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                      <IconBook className="w-3 h-3 text-blue-500 shrink-0" />
                      Semestre {c.semestre}
                    </span>
                    <span>•</span>
                    <span>
                      {c.creditos} {c.creditos === 1 ? "crédito" : "créditos"}
                    </span>
                    <span>•</span>
                    <span>{c.creditos > 0 ? `${c.creditos * 48} horas` : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción: reordenar y eliminar */}
              {!deshabilitado && (
                <div className="flex items-center justify-end gap-1 shrink-0 self-end sm:self-center pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => moverArriba(index)}
                    disabled={index === 0 || pendiente}
                    title="Mover arriba"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <IconChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverAbajo(index)}
                    disabled={index === cursos.length - 1 || pendiente}
                    title="Mover abajo"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <IconChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(index)}
                    disabled={pendiente}
                    title="Quitar curso"
                    className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-30 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selector para agregar nueva asignatura */}
      {!deshabilitado && asignaturasDisponibles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex-1 min-w-0">
            <select
              value={asignaturaSeleccionadaId}
              onChange={(e) => setAsignaturaSeleccionadaId(e.target.value)}
              disabled={pendiente}
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="">+ Seleccionar asignatura del pensum para agregar…</option>
              {asignaturasPorSemestre.map(([semestre, materias]) => (
                <optgroup key={semestre} label={`Semestre ${semestre}`}>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo ? `[${m.codigo}] ` : ""}
                      {m.nombre} ({m.creditos} cr)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={agregarAsignatura}
            disabled={!asignaturaSeleccionadaId || pendiente}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white disabled:opacity-40 px-3.5 py-2 rounded-xl transition-colors shrink-0"
          >
            <IconPlus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      )}

      {/* Barra de acciones: Restablecer sugerencia y Guardar cambios */}
      {!deshabilitado && (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={restablecerSugerencia}
            disabled={pendiente}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <IconRotate className="w-3.5 h-3.5" />
            Restablecer sugerencia automática
          </button>

          <button
            type="button"
            onClick={guardar}
            disabled={pendiente || (!haCambiado && esGuardado)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl shadow-xs transition-colors"
          >
            <IconDeviceFloppy className="w-4 h-4" />
            {pendiente ? "Guardando..." : "Guardar cursos de matrícula"}
          </button>
        </div>
      )}
    </div>
  );
}
