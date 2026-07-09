"use client";

import { useTransition } from "react";
import { sileo } from "sileo";

import type { Rol } from "@/types";
import { cambiarRol } from "./acciones";

const OPCIONES: { valor: Rol; label: string }[] = [
  { valor: "admin", label: "Administrador" },
  { valor: "asesor", label: "Asesor" },
  { valor: "verificador", label: "Verificador" },
];

// Select compacto para reasignar el rol de un miembro del staff desde la lista.
export function SelectorRol({
  usuarioId,
  rol,
  deshabilitado,
}: {
  usuarioId: string;
  rol: Rol;
  deshabilitado?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

  function alCambiar(nuevo: string) {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("usuarioId", usuarioId);
      fd.set("rol", nuevo);
      const res = await cambiarRol(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo cambiar el rol", description: res.error });
        return;
      }
      sileo.success({ title: "Rol actualizado" });
    });
  }

  return (
    <select
      value={rol}
      disabled={pendiente || deshabilitado}
      onChange={(e) => alCambiar(e.target.value)}
      title={deshabilitado ? "No puedes cambiar tu propio rol" : "Cambiar rol"}
      className="text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 disabled:opacity-50 outline-none focus:ring-2 focus:ring-marca/30"
    >
      {OPCIONES.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
