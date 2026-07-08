"use client";

import { useState, useTransition } from "react";
import {
  IconChevronDown as ChevronDown,
  IconPencil as Pencil,
  IconPlus as Plus,
} from "@tabler/icons-react";
import { sileo } from "sileo";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { agregarAsignatura, editarAsignatura, eliminarAsignatura } from "./acciones";

// Pensum de una carrera con edición manual: la extracción automática del PDF puede fallar u omitir,
// así que el admin puede corregir cualquier asignatura (nombre/código/créditos/semestre), agregar las
// que falten o eliminar sobrantes. Mismo patrón de Dialog editor que el estudio del caso.

export type AsignaturaEditable = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  semestre: number;
};

type Editor = { modo: "crear" } | { modo: "editar"; asignatura: AsignaturaEditable };

export function PensumEditable({
  pensumId,
  asignaturas,
}: {
  pensumId: string;
  asignaturas: AsignaturaEditable[];
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pendiente, iniciar] = useTransition();

  const semestres = Array.from(new Set(asignaturas.map((a) => a.semestre))).sort((a, b) => a - b);

  function guardar(fd: FormData) {
    const actual = editor;
    if (!actual) return;
    fd.set("pensumId", pensumId);
    if (actual.modo === "editar") fd.set("asignaturaId", actual.asignatura.id);
    iniciar(async () => {
      const res = actual.modo === "editar" ? await editarAsignatura(fd) : await agregarAsignatura(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo guardar", description: res.error });
        return;
      }
      sileo.success({ title: actual.modo === "editar" ? "Asignatura actualizada" : "Asignatura agregada" });
      setEditor(null);
    });
  }

  function eliminar() {
    const actual = editor;
    if (!actual || actual.modo !== "editar") return;
    const fd = new FormData();
    fd.set("asignaturaId", actual.asignatura.id);
    iniciar(async () => {
      const res = await eliminarAsignatura(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo eliminar", description: res.error });
        return;
      }
      sileo.warning({ title: "Asignatura eliminada", description: "Sus vinculaciones también se quitaron." });
      setEditor(null);
    });
  }

  return (
    <>
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
                    .map((a) => (
                      <li
                        key={a.id}
                        className="group/fila flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200 py-0.5"
                      >
                        <span className="min-w-0 truncate">{a.nombre}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{a.creditos} cr</span>
                          <button
                            type="button"
                            onClick={() => setEditor({ modo: "editar", asignatura: a })}
                            className="p-1 rounded text-slate-400 dark:text-slate-500 opacity-0 group-hover/fila:opacity-100 focus-visible:opacity-100 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
                            aria-label={`Editar ${a.nombre}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={() => setEditor({ modo: "crear" })}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
      >
        <Plus className="w-4 h-4" /> Agregar asignatura
      </button>

      <Dialog open={editor !== null} onOpenChange={(abierto) => !abierto && setEditor(null)}>
        <DialogContent key={editor?.modo === "editar" ? editor.asignatura.id : "crear"}>
          <DialogHeader>
            <DialogTitle>{editor?.modo === "editar" ? "Editar asignatura" : "Agregar asignatura"}</DialogTitle>
            <DialogDescription>
              {editor?.modo === "editar"
                ? "Corrige lo que la extracción del PDF no leyó bien."
                : "Agrega una asignatura del plan que la extracción no detectó."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardar(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="asig-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Nombre
              </label>
              <input
                id="asig-nombre"
                name="nombre"
                type="text"
                required
                defaultValue={editor?.modo === "editar" ? editor.asignatura.nombre : ""}
                placeholder="Ej.: Cálculo Diferencial"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="asig-codigo" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Código
                </label>
                <input
                  id="asig-codigo"
                  name="codigo"
                  type="text"
                  defaultValue={editor?.modo === "editar" ? editor.asignatura.codigo ?? "" : ""}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="asig-creditos" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Créditos
                </label>
                <input
                  id="asig-creditos"
                  name="creditos"
                  type="number"
                  min={0}
                  defaultValue={editor?.modo === "editar" ? editor.asignatura.creditos : ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="asig-semestre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Semestre
                </label>
                <input
                  id="asig-semestre"
                  name="semestre"
                  type="number"
                  min={1}
                  required
                  defaultValue={editor?.modo === "editar" ? editor.asignatura.semestre : ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              {editor?.modo === "editar" && (
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                >
                  Eliminar
                </button>
              )}
              <button
                type="submit"
                disabled={pendiente}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {editor?.modo === "editar" ? "Guardar cambios" : "Agregar asignatura"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
