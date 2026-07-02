"use client";

import { useState, useTransition } from "react";
import {
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  IconSchool as GraduationCap,
  IconArrowRight as ArrowRight,
  IconFileText as FileText,
  IconBook as BookOpen,
  IconPencil as Pencil,
  IconDeviceFloppy as Save,
  IconDownload as Download,
} from "@tabler/icons-react";
import clsx from "clsx";
import { sileo } from "sileo";

import { reabrirCaso, guardarNota } from "./acciones";
import { SelectorPlantilla } from "./selector-plantilla";

// Resumen de un caso ya cerrado (aprobado/rechazado): cómo quedó la homologación + la nota para el
// estudiante. El admin puede editar la nota cuando quiera, o reabrir la revisión para cambiar todo.
export function ResumenCaso({
  caso,
  homologaciones,
  urlCertificado,
  urlPlan,
  plantillas,
}: {
  caso: {
    id: string;
    institucion: string;
    carrera: string;
    estado: "aprobado" | "rechazado";
    semestre: number | null;
    notaAdmin: string | null;
    notaInterna: string | null;
    decididoEn: string | null;
    decididoPor: string | null;
  };
  homologaciones: { materia: string; asignatura: string }[];
  urlCertificado: string | null;
  urlPlan: string | null;
  plantillas: { id: string; texto: string }[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [nota, setNota] = useState(caso.notaAdmin ?? "");
  const [notaInterna, setNotaInterna] = useState(caso.notaInterna ?? "");
  const aprobado = caso.estado === "aprobado";

  function reabrir() {
    iniciar(async () => {
      const datos = new FormData();
      datos.set("casoId", caso.id);
      await reabrirCaso(datos);
      sileo.success({ title: "Revisión reabierta", description: "Puedes editar el caso de nuevo." });
    });
  }

  function guardar() {
    iniciar(async () => {
      const datos = new FormData();
      datos.set("casoId", caso.id);
      datos.set("nota", nota);
      datos.set("notaInterna", notaInterna);
      await guardarNota(datos);
      sileo.success({ title: "Notas guardadas" });
    });
  }

  // Sello de auditoría: quién cerró el caso y cuándo (cuando hay datos; los casos viejos no los traen).
  const decididoTexto = caso.decididoEn
    ? `${caso.decididoPor ? `Decidido por ${caso.decididoPor}` : "Decidido"} · ${new Intl.DateTimeFormat(
        "es",
        { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
      ).format(new Date(caso.decididoEn))}`
    : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Encabezado del veredicto */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 text-center">
          <div
            className={clsx(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
              aprobado
                ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
            )}
          >
            {aprobado ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {aprobado ? "Homologación aprobada" : "Homologación rechazada"}
          </h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 break-words flex items-center justify-center gap-1.5 flex-wrap">
            <span>{caso.institucion}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>{caso.carrera}</span>
          </p>
          {aprobado && caso.semestre != null && (
            <div className="mt-5 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-5 py-3 rounded-xl">
              <GraduationCap className="w-5 h-5" />
              <span className="font-semibold">Queda en el semestre {caso.semestre}</span>
            </div>
          )}
          {decididoTexto && (
            <p suppressHydrationWarning className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              {decididoTexto}
            </p>
          )}
        </div>

        {/* Materias homologadas */}
        {aprobado && homologaciones.length > 0 && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Materias homologadas ({homologaciones.length})
            </h3>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {homologaciones.map((h, i) => (
                <div key={i} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 text-sm">
                  <span className="flex-1 min-w-0 text-slate-600 dark:text-slate-300 truncate">{h.materia}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="flex-1 min-w-0 font-semibold text-slate-900 dark:text-slate-100 truncate text-right">
                    {h.asignatura}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notas del caso (editables en cualquier momento): la del estudiante y la interna. */}
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Notas del caso
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Nota para el estudiante
                </label>
                <SelectorPlantilla
                  plantillas={plantillas}
                  onInsertar={(t) => setNota((prev) => (prev.trim() ? `${prev}\n${t}` : t))}
                />
              </div>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Escribe una nota para el estudiante (opcional)…"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none text-sm"
              />
            </div>
            <div>
              {/* "Interna" se señala con el punto ámbar del label, no tiñendo el input entero: el
                  campo queda neutro como los demás (el tinte ámbar completo se veía mal en oscuro). */}
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                Nota interna{" "}
                <span className="font-normal text-slate-400 dark:text-slate-500">(no la ve el estudiante)</span>
              </label>
              <textarea
                value={notaInterna}
                onChange={(e) => setNotaInterna(e.target.value)}
                rows={2}
                placeholder="Anotaciones internas del equipo (opcional)…"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none text-sm"
              />
            </div>
            <div className="flex justify-end">
              {/* Botón con borde (mejor affordance que un enlace suelto) y hover válido en ambos
                  modos: el hover:text-blue-900 anterior desaparecía sobre fondo oscuro. */}
              <button
                type="button"
                onClick={guardar}
                disabled={pendiente}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 rounded-lg px-3 py-1.5 hover:bg-sky-100 dark:hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" /> Guardar notas
              </button>
            </div>
          </div>
        </section>

        {/* Acta de homologación en PDF: solo cuando el caso quedó aprobado. */}
        {aprobado && (
          <a
            href={`/casos/${caso.id}/acta`}
            className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 rounded-xl shadow-sm shadow-emerald-600/20 dark:shadow-none transition-colors"
          >
            <Download className="w-5 h-5" /> Descargar acta de homologación (PDF)
          </a>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={reabrir}
            disabled={pendiente}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-marca text-marca-fg hover:bg-marca-hover dark:bg-marca-hover dark:hover:bg-marca disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" /> Editar revisión
          </button>
          {urlCertificado && (
            <a
              href={urlCertificado}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FileText className="w-4 h-4" /> Ver certificado
            </a>
          )}
          {urlPlan && (
            <a
              href={urlPlan}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <BookOpen className="w-4 h-4" /> Ver pensum
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
