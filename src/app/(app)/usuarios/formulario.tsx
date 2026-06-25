"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { IconUserPlus as UserPlus } from "@tabler/icons-react";
import { sileo } from "sileo";

import { crearAdmin, type EstadoUsuario } from "./acciones";

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 bg-marca text-marca-fg px-5 py-2.5 rounded-xl font-bold hover:bg-marca-hover disabled:opacity-60 transition-colors shadow-sm"
    >
      <UserPlus className="w-4 h-4" />
      {pending ? "Creando…" : "Crear administrador"}
    </button>
  );
}

const inputClase =
  "w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none transition-all text-slate-700 dark:text-slate-200 focus:border-marca focus:ring-2 focus:ring-marca/30";

export function FormularioUsuario() {
  const [estado, accion] = useFormState<EstadoUsuario, FormData>(crearAdmin, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado && "error" in estado) {
      sileo.error({ title: "No se pudo crear", description: estado.error });
    } else if (estado && "ok" in estado) {
      sileo.success({ title: "Administrador creado", description: "Ya puede iniciar sesión." });
      formRef.current?.reset();
    }
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nombre" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            Nombre
          </label>
          <input id="nombre" name="nombre" type="text" required placeholder="Ej.: Salomón Montilla" className={inputClase} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            Correo
          </label>
          <input id="email" name="email" type="email" required placeholder="admin@institucion.edu" autoComplete="off" className={inputClase} />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          Contraseña <span className="text-slate-400 dark:text-slate-500 font-normal">(mínimo 8 caracteres)</span>
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClase} />
      </div>
      <div className="flex justify-end">
        <BotonCrear />
      </div>
    </form>
  );
}
