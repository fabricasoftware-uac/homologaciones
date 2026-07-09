"use client";

import { useState, useTransition } from "react";
import {
  IconPlus as Plus,
  IconPencil as Pencil,
  IconTrash as Trash,
  IconAlertTriangle as AlertTriangle,
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
import { crearCarrera, renombrarCarrera, eliminarCarrera } from "./acciones";

// Gestión del catálogo de carreras (solo admin): crear, renombrar y eliminar. Mismo patrón de
// Dialog que el editor del pensum, para que todo el módulo se sienta una sola pieza.

const inputClase =
  "w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm";

// Botón "Nueva carrera" (encabezado de la página) con su diálogo de creación.
export function NuevaCarrera() {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function crear(fd: FormData) {
    iniciar(async () => {
      const res = await crearCarrera(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo crear", description: res.error });
        return;
      }
      sileo.success({ title: "Carrera creada", description: "Sube su plan en PDF para cargar el pensum." });
      setAbierto(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 bg-marca text-marca-fg px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-marca-hover shadow-sm transition-colors"
      >
        <Plus className="w-4 h-4" /> Nueva carrera
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carrera</DialogTitle>
            <DialogDescription>
              Se crea sin pensum: súbele después el PDF del plan (o agrega sus asignaturas a mano).
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="carrera-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Nombre de la carrera
              </label>
              <input
                id="carrera-nombre"
                name="nombre"
                type="text"
                required
                autoFocus
                placeholder="Ej.: Ingeniería Industrial"
                className={inputClase}
              />
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={pendiente}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                Crear carrera
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Acciones de una carrera existente (en su tarjeta): renombrar y eliminar.
export function AccionesCarrera({
  pensumId,
  carrera,
  asignaturas,
  casos,
}: {
  pensumId: string;
  carrera: string;
  asignaturas: number;
  casos: number;
}) {
  const [dialogo, setDialogo] = useState<"renombrar" | "eliminar" | null>(null);
  const [pendiente, iniciar] = useTransition();

  function renombrar(fd: FormData) {
    fd.set("pensumId", pensumId);
    iniciar(async () => {
      const res = await renombrarCarrera(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo renombrar", description: res.error });
        return;
      }
      sileo.success({ title: "Carrera renombrada" });
      setDialogo(null);
    });
  }

  function eliminar() {
    const fd = new FormData();
    fd.set("pensumId", pensumId);
    iniciar(async () => {
      const res = await eliminarCarrera(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo eliminar", description: res.error });
        return;
      }
      sileo.warning({ title: "Carrera eliminada", description: "Su pensum y su PDF también se quitaron." });
      setDialogo(null);
    });
  }

  return (
    <>
      {/* Discretos en el encabezado de la tarjeta: aparecen al pasar el mouse (o con teclado). */}
      <span className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setDialogo("renombrar")}
          title="Renombrar carrera"
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setDialogo("eliminar")}
          title="Eliminar carrera"
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        >
          <Trash className="w-4 h-4" />
        </button>
      </span>

      <Dialog open={dialogo !== null} onOpenChange={(abierto) => !abierto && setDialogo(null)}>
        <DialogContent>
          {dialogo === "renombrar" ? (
            <>
              <DialogHeader>
                <DialogTitle>Renombrar carrera</DialogTitle>
                <DialogDescription>
                  El pensum, el PDF y los casos existentes se conservan; solo cambia el nombre.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  renombrar(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="carrera-nuevo-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Nombre
                  </label>
                  <input
                    id="carrera-nuevo-nombre"
                    name="nombre"
                    type="text"
                    required
                    autoFocus
                    defaultValue={carrera}
                    className={inputClase}
                  />
                </div>
                <DialogFooter>
                  <button
                    type="submit"
                    disabled={pendiente}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                  >
                    Guardar
                  </button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>¿Eliminar {carrera}?</DialogTitle>
                <DialogDescription>
                  {casos > 0
                    ? `No se puede: ${casos} caso${casos === 1 ? " apunta" : "s apuntan"} a esta carrera. Elimina o reasigna esos casos primero.`
                    : asignaturas > 0
                      ? `Se eliminarán la carrera, sus ${asignaturas} asignaturas y el PDF del plan. Esta acción no se puede deshacer.`
                      : "Se eliminará la carrera (no tiene pensum cargado). Esta acción no se puede deshacer."}
                </DialogDescription>
              </DialogHeader>
              {casos === 0 && (
                <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  Los estudiantes ya no podrán pedir homologación hacia esta carrera.
                </p>
              )}
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setDialogo(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                {casos === 0 && (
                  <button
                    type="button"
                    onClick={eliminar}
                    disabled={pendiente}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                  >
                    Eliminar carrera
                  </button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
