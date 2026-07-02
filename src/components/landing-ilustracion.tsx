"use client";

import { motion } from "motion/react";
import {
  IconLink as LinkIcon,
  IconSparkles as Sparkles,
  IconSchool as GraduationCap,
} from "@tabler/icons-react";

// Ilustración animada del producto para la landing: un mini "estudio de homologación" donde las
// materias del estudiante se ENLAZAN en secuencia con las del plan destino (la línea se dibuja, el
// % de la IA hace pop y ambas tarjetas quedan con su acento verde), y al final aparece el resultado
// (progreso + semestre sugerido). Está hecha en DOM + motion —no es una imagen estática— así que
// hereda los colores del tema (claro/oscuro) y de la marca, y usa la MISMA paleta del estudio real:
// sky = enlace, emerald = aprobado. Anima una sola vez al entrar en viewport.

const PARES = [
  { origen: "Cálculo I", nota: "4.5", destino: "Cálculo Diferencial", similitud: 98 },
  { origen: "Programación I", nota: "4.2", destino: "Intro. a la Programación", similitud: 95 },
  { origen: "Álgebra", nota: "3.9", destino: "Álgebra Lineal", similitud: 92 },
];

// Un solo margen de viewport para que toda la secuencia arranque junta.
const vista = { once: true, margin: "-80px" } as const;

const pop = { type: "spring", stiffness: 420, damping: 22 } as const;

function TarjetaMini({
  lado,
  titulo,
  subtitulo,
  extremo,
  delayEntrada,
  delayAprobada,
}: {
  lado: "izq" | "der";
  titulo: string;
  subtitulo: React.ReactNode;
  extremo?: React.ReactNode;
  delayEntrada: number;
  delayAprobada: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: lado === "izq" ? -14 : 14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={vista}
      transition={{ duration: 0.5, delay: delayEntrada, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 min-w-0"
    >
      {/* Barra de acento verde: aparece cuando el par queda "aprobado" (misma señal del estudio). */}
      <motion.span
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={vista}
        transition={{ duration: 0.35, delay: delayAprobada }}
        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-emerald-500"
      />
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {titulo}
        </p>
        {extremo}
      </div>
      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
        {subtitulo}
      </p>
    </motion.div>
  );
}

export function IlustracionEstudio() {
  return (
    <div className="relative">
      {/* Resplandores de marca detrás del panel, para que "flote" sobre la página. */}
      <div className="pointer-events-none absolute -top-12 -left-12 w-60 h-60 rounded-full bg-marca/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-12 w-60 h-60 rounded-full bg-acento/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={vista}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden"
      >
        {/* Barra de "ventana": ubica al visitante (esto es la app, no un dibujo). */}
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
            Estudio de homologación
          </span>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-marca bg-marca/10 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" /> IA + revisión humana
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {/* Encabezados de las dos columnas. */}
          <div className="grid grid-cols-[1fr_2.25rem_1fr] sm:grid-cols-[1fr_3.5rem_1fr] items-center px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Lo que cursaste</span>
            <span />
            <span className="text-right">Te vale por</span>
          </div>

          {/* Los pares se enlazan en secuencia: tarjeta -> línea -> nodo -> % -> acento verde. */}
          {PARES.map((par, i) => {
            const base = 0.35 + i * 0.55;
            return (
              <div
                key={par.origen}
                className="grid grid-cols-[1fr_2.25rem_1fr] sm:grid-cols-[1fr_3.5rem_1fr] items-center"
              >
                <TarjetaMini
                  lado="izq"
                  titulo={par.origen}
                  subtitulo={`Nota ${par.nota}`}
                  delayEntrada={base}
                  delayAprobada={base + 0.75}
                />

                {/* Conector: la línea se dibuja y el nodo del enlace hace pop en el centro. */}
                <div className="relative h-6 flex items-center justify-center">
                  <motion.span
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={vista}
                    transition={{ duration: 0.4, delay: base + 0.25, ease: "easeOut" }}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-sky-400 to-sky-500 origin-left"
                  />
                  <motion.span
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={vista}
                    transition={{ ...pop, delay: base + 0.5 }}
                    className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/40"
                  >
                    <LinkIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </motion.span>
                </div>

                <TarjetaMini
                  lado="der"
                  titulo={par.destino}
                  subtitulo="Plan destino"
                  delayEntrada={base + 0.1}
                  delayAprobada={base + 0.75}
                  extremo={
                    <motion.span
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={vista}
                      transition={{ ...pop, delay: base + 0.6 }}
                      className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 rounded-full shrink-0"
                    >
                      <Sparkles className="w-3 h-3" /> {par.similitud}%
                    </motion.span>
                  }
                />
              </div>
            );
          })}

          {/* Resultado: el progreso se llena y aparece el semestre sugerido. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={vista}
            transition={{ duration: 0.5, delay: 2.15 }}
            className="mt-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Materias homologadas</span>
                <span className="text-slate-700 dark:text-slate-200">3 de 3</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={vista}
                  transition={{ duration: 0.9, delay: 2.4, ease: "easeOut" }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
            <motion.span
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={vista}
              transition={{ ...pop, delay: 3 }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-marca bg-marca/10 ring-1 ring-marca/20 dark:bg-white/10 dark:text-slate-100 dark:ring-white/15 px-3 py-1.5 rounded-xl whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" /> 3.er semestre
            </motion.span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
