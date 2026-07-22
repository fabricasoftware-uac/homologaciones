"use client";

import { useTransition } from "react";
import { IconUserCheck as UserCheck } from "@tabler/icons-react";
import { sileo } from "sileo";

import { asignarCaso } from "./acciones";

// Selector (solo admin) para asignar el caso a un asesor. El asesor asignado ve el caso en su
// bandeja (RLS) y recibe una notificación dirigida en su campana.
export function AsignarAsesor({
  casoId,
  asesores,
  asesorId,
}: {
  casoId: string;
  asesores: { id: string; nombre: string }[];
  asesorId: string | null;
}) {
  const [pendiente, iniciar] = useTransition();

  function alCambiar(nuevo: string) {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", casoId);
      fd.set("asesorId", nuevo);
      const res = await asignarCaso(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo asignar", description: res.error });
        return;
      }
      sileo.success({
        title: nuevo ? "Caso asignado" : "Asignación quitada",
        description: nuevo ? "El asesor lo verá en su bandeja." : undefined,
      });
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
      <UserCheck className="w-4 h-4 shrink-0" />
      <select
        value={asesorId ?? ""}
        disabled={pendiente}
        onChange={(e) => alCambiar(e.target.value)}
        title="Asignar este caso a un asesor"
        className="bg-transparent outline-none text-sm disabled:opacity-50 max-w-[160px]"
      >
        <option value="">Sin asesor</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
