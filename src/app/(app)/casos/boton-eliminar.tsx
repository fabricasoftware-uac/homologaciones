"use client";

import { useTransition } from "react";
import { IconTrash as Trash2 } from "@tabler/icons-react";
import { sileo } from "sileo";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { eliminarCaso } from "./acciones";

// Botón para eliminar un caso desde la bandeja, con confirmación (es destructivo e irreversible:
// borra también las materias, los vínculos y el PDF). Avisa con una notificación al terminar.
export function BotonEliminarCaso({ casoId }: { casoId: string }) {
  const [pendiente, iniciar] = useTransition();

  function eliminar() {
    iniciar(async () => {
      const datos = new FormData();
      datos.set("casoId", casoId);
      await eliminarCaso(datos);
      sileo.success({ title: "Caso eliminado" });
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          title="Eliminar caso"
          className="text-slate-400 dark:text-slate-500 hover:text-eliminar transition-colors disabled:opacity-50"
          disabled={pendiente}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este caso?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es permanente. Se eliminarán también las materias detectadas, los vínculos y
            el certificado en PDF. No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={eliminar}
            className="bg-eliminar text-eliminar-fg hover:bg-eliminar-hover focus-visible:ring-eliminar"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
