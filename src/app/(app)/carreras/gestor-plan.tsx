"use client";

import { useEffect, useRef, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { IconUpload as Upload, IconTrash as Trash2, IconEye as Eye } from "@tabler/icons-react";
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
import { subirPlanPdf, eliminarPlanPdf } from "./acciones";

// Gestor del PDF del plan de una carrera: subir, ver, reemplazar y eliminar. El input de archivo
// está oculto; el botón lo abre y, al elegir un PDF, se envía solo. La confirmación de borrado usa
// nuestro AlertDialog (NUNCA window.confirm, que rompe la UX con el diálogo nativo del navegador).
export function GestorPlanPdf({
  pensumId,
  ruta,
  url,
}: {
  pensumId: string;
  ruta: string | null;
  url: string | null;
}) {
  const [estado, accion] = useFormState(subirPlanPdf, null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [eliminando, iniciar] = useTransition();

  useEffect(() => {
    if (estado && "error" in estado) {
      sileo.error({ title: "No se pudo subir el PDF", description: estado.error });
    } else if (estado && "ok" in estado) {
      sileo.success({ title: "Pensum subido", description: estado.detalle });
    }
  }, [estado]);

  function eliminar() {
    iniciar(async () => {
      const datos = new FormData();
      datos.set("pensumId", pensumId);
      datos.set("ruta", ruta ?? "");
      await eliminarPlanPdf(datos);
      sileo.success({ title: "PDF eliminado" });
    });
  }

  return (
    <form action={accion} className="flex items-center gap-4 flex-wrap text-sm">
      <input type="hidden" name="pensumId" value={pensumId} />
      <input
        ref={inputRef}
        type="file"
        name="archivo"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
        }}
      />

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900"
        >
          <Eye className="w-4 h-4" /> Ver PDF
        </a>
      )}

      <BotonSubir tieneArchivo={!!ruta} onClick={() => inputRef.current?.click()} />

      {url && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={eliminando}
              className="inline-flex items-center gap-1.5 font-medium text-eliminar hover:opacity-80 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar el PDF de esta carrera?</AlertDialogTitle>
              <AlertDialogDescription>
                Se quitará el PDF del plan. Las asignaturas ya cargadas se conservan. Puedes volver a
                subirlo cuando quieras.
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
      )}
    </form>
  );
}

function BotonSubir({ tieneArchivo, onClick }: { tieneArchivo: boolean; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
    >
      <Upload className="w-4 h-4" />
      {pending ? "Analizando pensum..." : tieneArchivo ? "Reemplazar" : "Subir PDF"}
    </button>
  );
}
