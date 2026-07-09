"use client";

import { useState, useTransition } from "react";
import { IconPencil as Pencil, IconTrash as Trash } from "@tabler/icons-react";
import { sileo } from "sileo";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { editarUsuario, eliminarUsuario } from "./acciones";

// Editar (nombre / contraseña) y eliminar un miembro del staff, desde su fila de la lista.
// Solo el admin llega aquí (la página entera es de admin); eliminarse a sí mismo está bloqueado.

const inputClase =
  "w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm";

export function EditorUsuario({
  usuarioId,
  nombre,
  email,
  esYo,
}: {
  usuarioId: string;
  nombre: string;
  email: string;
  esYo: boolean;
}) {
  const [dialogo, setDialogo] = useState<"editar" | "eliminar" | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar(fd: FormData) {
    fd.set("usuarioId", usuarioId);
    iniciar(async () => {
      const res = await editarUsuario(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo guardar", description: res.error });
        return;
      }
      sileo.success({ title: "Usuario actualizado" });
      setDialogo(null);
    });
  }

  function eliminar() {
    const fd = new FormData();
    fd.set("usuarioId", usuarioId);
    iniciar(async () => {
      const res = await eliminarUsuario(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo eliminar", description: res.error });
        return;
      }
      sileo.warning({ title: "Usuario eliminado", description: "Ya no puede iniciar sesión." });
      setDialogo(null);
    });
  }

  return (
    <>
      <span className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setDialogo("editar")}
          title="Editar usuario"
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setDialogo("eliminar")}
          disabled={esYo}
          title={esYo ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
        >
          <Trash className="w-4 h-4" />
        </button>
      </span>

      <Dialog open={dialogo !== null} onOpenChange={(abierto) => !abierto && setDialogo(null)}>
        <DialogContent>
          {dialogo === "editar" ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar usuario</DialogTitle>
                <DialogDescription>{email}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  guardar(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="usr-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Nombre
                  </label>
                  <input
                    id="usr-nombre"
                    name="nombre"
                    type="text"
                    required
                    autoFocus
                    defaultValue={nombre}
                    className={inputClase}
                  />
                </div>
                <div>
                  <label htmlFor="usr-clave" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Nueva contraseña{" "}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      (opcional; déjala vacía para no cambiarla)
                    </span>
                  </label>
                  <input
                    id="usr-clave"
                    name="password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className={inputClase}
                  />
                </div>
                <DialogFooter>
                  <button
                    type="submit"
                    disabled={pendiente}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                  >
                    Guardar cambios
                  </button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>¿Eliminar a {nombre}?</DialogTitle>
                <DialogDescription>
                  Su cuenta ({email}) dejará de existir y no podrá iniciar sesión. Los casos que
                  decidió o tenía asignados se conservan; solo pierden esa referencia.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setDialogo(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                >
                  Eliminar usuario
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
