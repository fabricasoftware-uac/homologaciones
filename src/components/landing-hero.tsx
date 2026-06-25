"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "motion/react";
import {
  IconSparkles as Sparkles,
  IconArrowRight as ArrowRight,
  IconShieldCheck as ShieldCheck,
} from "@tabler/icons-react";

import type { Configuracion } from "@/lib/marca/configuracion";
import { Contador } from "./landing-anim";

// Hero de la landing con "wow-factor": un foco (spotlight) que sigue al cursor, orbes que derivan
// lento, una grilla de puntos difuminada y los contadores animados. Sin librerías nuevas (motion ya
// está). El foco se mueve actualizando variables CSS por ref (sin re-render).
export function LandingHero({
  marca,
  tieneSesion,
  carreras,
}: {
  marca: Configuracion;
  tieneSesion: boolean;
  carreras: number;
}) {
  const ref = useRef<HTMLElement>(null);

  function mover(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  const entra = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  });

  return (
    <section
      ref={ref}
      onMouseMove={mover}
      className="relative overflow-hidden"
      style={{ "--mx": "50%", "--my": "28%" } as React.CSSProperties}
    >
      {/* Foco que sigue al cursor (color de marca). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-50"
        style={{
          background:
            "radial-gradient(540px circle at var(--mx) var(--my), color-mix(in oklab, var(--marca) 16%, transparent), transparent 42%)",
        }}
      />
      {/* Grilla de puntos difuminada hacia el centro-arriba. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--marca) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent)",
        }}
      />
      {/* Orbes que derivan. */}
      <div
        className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full bg-marca/20 blur-3xl"
        style={{ animation: "flotar 9s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-acento/20 blur-3xl"
        style={{ animation: "flotar 11s ease-in-out infinite 1.5s" }}
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <motion.span
          {...entra(0)}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-marca bg-marca/10 px-3 py-1.5 rounded-full ring-1 ring-marca/15"
        >
          <Sparkles className="w-3.5 h-3.5" /> Homologación asistida por IA
        </motion.span>
        <motion.h1
          {...entra(0.08)}
          className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]"
        >
          Homologa tu carrera en {marca.nombre} sin filas ni esperas
        </motion.h1>
        <motion.p
          {...entra(0.16)}
          className="mt-5 text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto"
        >
          {marca.eslogan ||
            "Sube tu certificado de notas y descubre en minutos qué materias se te homologan y a qué semestre ingresarías."}
        </motion.p>
        <motion.div
          {...entra(0.24)}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/homologar"
            className="inline-flex items-center gap-2 bg-marca text-marca-fg font-bold px-7 py-3.5 rounded-xl hover:bg-marca-hover shadow-lg shadow-marca/20 transition-colors"
          >
            Homologar mi carrera
            <ArrowRight className="w-5 h-5" />
          </Link>
          {tieneSesion && (
            <Link
              href="/mis-homologaciones"
              className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-7 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Ver mis homologaciones
            </Link>
          )}
        </motion.div>
        <motion.p
          {...entra(0.3)}
          className="mt-4 text-sm text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4" /> Gratis y sin crear cuenta
        </motion.p>

        {/* Contadores animados. */}
        <motion.div {...entra(0.4)} className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto">
          {carreras > 0 && <Stat valor={carreras} sufijo="" label="carreras" />}
          <Stat valor={5} sufijo=" min" label="tu estimación" />
          <Stat valor={100} sufijo="%" label="gratis" />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ valor, sufijo, label }: { valor: number; sufijo: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-extrabold text-marca tabular-nums">
        <Contador valor={valor} sufijo={sufijo} />
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
