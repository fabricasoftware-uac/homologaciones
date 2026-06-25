"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { IconMail as Mail, IconLock as Lock, IconArrowRight as ArrowRight } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

import { Logotipo } from "@/components/logotipo";
import type { Configuracion } from "@/lib/marca/configuracion";
import { ingresar, type EstadoAuth } from "./acciones";

// Botón de envío: usa el color de marca y cambia de texto mientras corre la server action.
function BotonIngresar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 bg-marca text-marca-fg font-bold py-3 rounded-xl hover:bg-marca-hover disabled:opacity-70 transition-colors shadow-sm shadow-marca/20"
    >
      {pending ? (
        "Ingresando…"
      ) : (
        <>
          Ingresar <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

// Overlay de transición: mientras la sesión se valida y se redirige a la app, cubrimos la pantalla
// con el degradado de marca, el logo y un spinner. Así el paso del login a la app es una transición
// suave (fundido) y no un corte brusco.
function OverlayIngreso({ marca, gradiente }: { marca: Configuracion; gradiente: string }) {
  const { pending } = useFormStatus();
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-white"
          style={{ backgroundImage: gradiente }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
          >
            <Logotipo marca={marca} size="lg" />
          </motion.div>
          <div className="mt-5 w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Campo({
  icono: Icono,
  name,
  type,
  label,
  placeholder,
  autoComplete,
}: {
  icono: Icon;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icono className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 dark:text-slate-500" />
        <input
          id={name}
          name={name}
          type={type}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none transition-all text-slate-800 dark:text-slate-200 focus:border-marca focus:ring-2 focus:ring-marca/30"
        />
      </div>
    </div>
  );
}

export function FormularioLogin({
  marca,
  gradiente,
}: {
  marca: Configuracion;
  gradiente: string;
}) {
  const [estado, accion] = useFormState<EstadoAuth, FormData>(ingresar, null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 p-7 sm:p-8"
    >
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Bienvenido de nuevo</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
        Inicia sesión para administrar las homologaciones.
      </p>

      <form action={accion} className="space-y-4">
        <Campo
          icono={Mail}
          name="email"
          type="email"
          label="Correo"
          placeholder="tu@correo.com"
          autoComplete="email"
        />
        <Campo
          icono={Lock}
          name="password"
          type="password"
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
        />
        {estado?.error && <p className="text-sm text-destructive">{estado.error}</p>}
        <div className="pt-1">
          <BotonIngresar />
        </div>
        <OverlayIngreso marca={marca} gradiente={gradiente} />
      </form>
    </motion.div>
  );
}
