"use client";

import { useState, useTransition } from "react";
import {
  IconClipboardCheck as ClipboardCheck,
  IconArrowRight as ArrowRight,
  IconDeviceFloppy as Save,
} from "@tabler/icons-react";
import clsx from "clsx";
import { sileo } from "sileo";

import { guardarMatricula } from "./acciones";

export type MateriaInscripcion = {
  vinculoId: string;
  materia: string;
  asignatura: string;
  matriculado: boolean;
};

const ESTADOS: { valor: string; label: string; punto: string }[] = [
  { valor: "pendiente", label: "Pendiente de contacto", punto: "bg-amber-400" },
  { valor: "contactado", label: "Estudiante contactado", punto: "bg-sky-400" },
  { valor: "inscrito", label: "Inscrito", punto: "bg-emerald-500" },
];

// Panel del verificador (también lo ve el admin) sobre un caso APROBADO: registrar el contacto con
// el estudiante, marcar qué materias homologadas ya quedaron matriculadas y dejar su propia nota.
// Guarda todo junto vía guardarMatricula (server action con re-chequeo de rol).
export function GestionInscripcion({
  casoId,
  estadoInicial,
  notaInicial,
  materias,
}: {
  casoId: string;
  estadoInicial: string;
  notaInicial: string | null;
  materias: MateriaInscripcion[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [estado, setEstado] = useState(estadoInicial);
  const [nota, setNota] = useState(notaInicial ?? "");
  const [matriculadas, setMatriculadas] = useState<string[]>(
    materias.filter((m) => m.matriculado).map((m) => m.vinculoId),
  );

  function alternar(vinculoId: string) {
    setMatriculadas((prev) =>
      prev.includes(vinculoId) ? prev.filter((x) => x !== vinculoId) : [...prev, vinculoId],
    );
  }

  function guardar() {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", casoId);
      fd.set("inscripcionEstado", estado);
      fd.set("notaVerificador", nota);
      fd.set("matriculados", matriculadas.join(","));
      const res = await guardarMatricula(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo guardar", description: res.error });
        return;
      }
      sileo.success({ title: "Gestión guardada" });
    });
  }

  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 inline-flex items-center gap-1.5">
        <ClipboardCheck className="w-4 h-4" /> Gestión de inscripción
      </h3>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
        {/* Estado del contacto con el estudiante */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Estado del proceso
          </label>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e.valor}
                type="button"
                onClick={() => setEstado(e.valor)}
                className={clsx(
                  "inline-flex items-center gap-1.5 text-sm font-semibold border rounded-lg px-3 py-1.5 transition-colors",
                  estado === e.valor
                    ? "border-marca bg-marca/10 text-slate-900 dark:text-slate-100 ring-2 ring-marca/30"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
              >
                <span className={clsx("inline-block w-1.5 h-1.5 rounded-full shrink-0", e.punto)} />
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist de matrícula: las materias homologadas, con su check de "ya quedó matriculada". */}
        {materias.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Materias matriculadas ({matriculadas.length} de {materias.length})
            </label>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {materias.map((m) => {
                const marcada = matriculadas.includes(m.vinculoId);
                return (
                  <label
                    key={m.vinculoId}
                    className={clsx(
                      "flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors",
                      marcada
                        ? "bg-emerald-50/60 dark:bg-emerald-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => alternar(m.vinculoId)}
                      className="w-4 h-4 rounded accent-emerald-600 shrink-0"
                    />
                    <span className="flex-1 min-w-0 text-slate-600 dark:text-slate-300 truncate">
                      {m.materia}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span
                      className={clsx(
                        "flex-1 min-w-0 truncate text-right",
                        marcada
                          ? "font-semibold text-emerald-800 dark:text-emerald-200"
                          : "font-medium text-slate-900 dark:text-slate-100",
                      )}
                    >
                      {m.asignatura}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Nota propia del verificador (separada de las notas del admin). */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Nota de la gestión{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ej.: se contactó por WhatsApp el 8/7, queda pendiente el pago de matrícula…"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={guardar}
            disabled={pendiente}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" /> Guardar gestión
          </button>
        </div>
      </div>
    </section>
  );
}
