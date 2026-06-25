"use client";

import { useTransition } from "react";
import { IconRefresh as Refresh } from "@tabler/icons-react";
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
import { reprocesarCaso } from "./acciones";

// Vuelve a correr el análisis de IA del caso. Útil sobre todo para los casos atascados en
// 'procesando' (el pipeline falló al enviar). Pide confirmación porque DESCARTA la propuesta actual
// (materias detectadas y vínculos sugeridos/aprobados) y la regenera desde el certificado.
export function BotonReprocesar({ casoId }: { casoId: string }) {
  const [pendiente, iniciar] = useTransition();

  function reprocesar() {
    iniciar(async () => {
      const datos = new FormData();
      datos.set("casoId", casoId);
      const resultado = await reprocesarCaso(datos);
      if (resultado?.error) {
        sileo.error({ title: "No se pudo reprocesar", description: resultado.error });
      } else {
        sileo.success({ title: "Caso reprocesado", description: "La propuesta se regeneró." });
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          title="Reprocesar con IA"
          disabled={pendiente}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <Refresh className={pendiente ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          <span className="hidden sm:inline">{pendiente ? "Reprocesando…" : "Reprocesar"}</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reprocesar este caso?</AlertDialogTitle>
          <AlertDialogDescription>
            Se volverá a analizar el certificado con la IA. Se descartarán las materias detectadas y
            los vínculos actuales (incluidos los que ya confirmaste) y se generará una propuesta
            nueva. Úsalo si el caso quedó atascado o quieres empezar de cero.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={reprocesar}>Reprocesar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
