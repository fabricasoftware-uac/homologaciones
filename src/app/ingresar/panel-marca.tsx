"use client";

import { motion } from "motion/react";

import { Logotipo } from "@/components/logotipo";
import type { Configuracion } from "@/lib/marca/configuracion";

// Panel de marca del login (mitad izquierda en escritorio).
//
// Antes era un degradado a pantalla completa con partículas flotando en bucle: bonito un segundo y
// mudo el resto. Quien entra aquí es un asesor que va a revisar casos, y lo que le habla es SU
// trabajo, no un fondo animado.
//
// Ahora el panel muestra el gesto del producto —una equivalencia resuelta— sobre el color de la
// institución. El degradado se conserva como base (es configurable por marca y ya está integrado con
// Configuración), pero deja de ser el protagonista: es el papel sobre el que se apoya el contenido.
export function PanelMarca({ marca, gradiente }: { marca: Configuracion; gradiente: string }) {
  const entra = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.55,
      delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  });

  return (
    <div
      className="relative hidden lg:flex flex-col justify-between w-[45%] xl:w-1/2 p-12 overflow-hidden text-white"
      style={{ backgroundImage: gradiente }}
    >
      {/* Velo oscuro: asienta el degradado para que el texto blanco tenga contraste con cualquier
          color de marca que configure la institución (incluidos los claros). */}
      <div className="pointer-events-none absolute inset-0 bg-slate-950/25" />

      <motion.div {...entra(0)} className="relative flex items-center gap-3">
        <Logotipo marca={marca} size="md" fondo="oscuro" />
        <span className="text-lg font-semibold tracking-tight">{marca.nombre}</span>
      </motion.div>

      <div className="relative max-w-md">
        <motion.p
          {...entra(0.08)}
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50"
        >
          Panel de homologaciones
        </motion.p>
        <motion.h2
          {...entra(0.14)}
          className="mt-4 text-3xl xl:text-[2.6rem] font-bold leading-[1.1] tracking-[-0.02em]"
        >
          {marca.eslogan || "Cada caso, resuelto con criterio."}
        </motion.h2>
        <motion.p {...entra(0.2)} className="mt-4 text-white/70 leading-relaxed">
          El sistema propone las equivalencias con su porcentaje y su razón. Tú decides cuáles valen.
        </motion.p>

        {/* Muestra de una equivalencia: lo que el asesor verá al entrar. */}
        <motion.div
          {...entra(0.28)}
          className="mt-9 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
            Materia de origen
          </p>
          <p className="mt-2 text-[15px] leading-snug">
            Desarrollar la solución de software de acuerdo con el diseño
          </p>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/20" />
            <span aria-hidden className="text-lg leading-none text-white/70">
              ≡
            </span>
            <span className="h-px flex-1 bg-white/20" />
          </div>
          <ul className="space-y-2">
            {[
              ["Programación I", 92],
              ["Bases de Datos", 95],
            ].map(([nombre, pct]) => (
              <li key={nombre as string} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-medium">{nombre}</span>
                <span className="h-1.5 w-12 rounded-full bg-white/20 overflow-hidden">
                  <span className="block h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-[13px] font-bold tabular-nums text-white/90 w-9 text-right">
                  {pct}%
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="relative text-xs text-white/40">
        © {new Date().getFullYear()} {marca.nombre}
      </div>
    </div>
  );
}
