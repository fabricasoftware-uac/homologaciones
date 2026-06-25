"use client";

import { motion } from "motion/react";

import { Logotipo } from "@/components/logotipo";
import type { Configuracion } from "@/lib/marca/configuracion";
import { Particulas } from "./particulas";

// Panel de marca del login (mitad izquierda en escritorio): el degradado elegido + partículas en
// movimiento + el logo, el eslogan y un mensaje, con entrada animada. Es la cara "de presentación";
// el formulario va en el panel claro de la derecha.
export function PanelMarca({ marca, gradiente }: { marca: Configuracion; gradiente: string }) {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between w-[45%] xl:w-1/2 p-12 overflow-hidden text-white"
      style={{ backgroundImage: gradiente }}
    >
      <Particulas className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/15" />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center gap-3"
      >
        <Logotipo marca={marca} size="md" fondo="oscuro" />
        <span className="text-lg font-semibold tracking-tight">{marca.nombre}</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-md"
      >
        <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
          {marca.eslogan || "Homologaciones académicas, claras y rápidas."}
        </h2>
        <p className="mt-4 text-white/70">
          Compara certificados, valida materias y resuelve cada caso en un solo lugar.
        </p>
      </motion.div>

      <div className="relative text-xs text-white/40">
        © {new Date().getFullYear()} {marca.nombre}
      </div>
    </div>
  );
}
