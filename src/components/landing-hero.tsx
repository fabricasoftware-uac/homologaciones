"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { IconArrowRight as ArrowRight, IconShieldCheck as ShieldCheck } from "@tabler/icons-react";

import type { Configuracion } from "@/lib/marca/configuracion";

// Hero de la landing.
//
// LA TESIS: lo más característico de este producto no es que use IA —eso lo dice todo el mundo— sino
// la EQUIVALENCIA: "lo que tú cursaste vale por esto de acá, en este porcentaje, por esta razón".
// Así que el hero no la describe: la MUESTRA, con un caso real de una constancia del SENA. Es además
// el mismo gesto de dos columnas del estudio de homologación, que es el corazón de la herramienta.
//
// Lo que había antes y se quitó, a conciencia: foco que seguía al cursor, dos orbes flotando en
// bucle, grilla de puntos difuminada y tres contadores animados ("100% gratis", "5 min"). Es el
// paquete decorativo por defecto —no dice nada de homologaciones, podría estar en la landing de
// cualquier cosa— y el movimiento perpetuo es justo lo que delata una plantilla. La animación que
// queda ocurre UNA vez, al cargar, y sirve para leer la equivalencia en el orden correcto:
// primero lo que traes, luego a qué equivale.

const EQUIVALENCIA = {
  origen: {
    fuente: "SENA · Tecnólogo en ADSO",
    nombre: "Desarrollar la solución de software de acuerdo con el diseño",
    meta: "1008 horas · Aprobado",
  },
  destino: [
    { nombre: "Programación I", creditos: 3, similitud: 92 },
    { nombre: "Programación II", creditos: 3, similitud: 88 },
    { nombre: "Bases de Datos", creditos: 3, similitud: 95 },
  ],
};

export function LandingHero({
  marca,
  tieneSesion,
}: {
  marca: Configuracion;
  tieneSesion: boolean;
  // Se mantiene en la firma porque la landing lo sigue pasando, pero el hero ya no muestra
  // contadores: un número de carreras no ayuda a decidir a quien llega a homologar.
  carreras?: number;
}) {
  const entra = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.5,
      delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  });

  return (
    <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
      {/* Un único gesto de fondo, quieto: una veladura de marca arriba a la derecha que da profundidad
          sin animarse ni competir con el contenido. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 32rem at 78% -8%, color-mix(in oklab, var(--marca) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          {/* ── Columna del mensaje ── */}
          <div>
            <motion.p {...entra(0)} className="etiqueta-registro">
              Homologación académica
            </motion.p>

            <motion.h1
              {...entra(0.06)}
              className="mt-5 text-[2.5rem] sm:text-[3.5rem] font-extrabold tracking-[-0.02em] leading-[1.04] text-slate-900 dark:text-slate-100"
            >
              Lo que ya estudiaste,
              <br />
              <span className="text-marca">reconocido</span> en {marca.nombre}.
            </motion.h1>

            <motion.p
              {...entra(0.12)}
              className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-lg"
            >
              {marca.eslogan ||
                "Sube tu certificado de notas y descubre qué materias se te homologan y a qué semestre entrarías. Sin filas, sin transcribir nada."}
            </motion.p>

            <motion.div {...entra(0.18)} className="mt-9 flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/homologar"
                className="group inline-flex items-center gap-2 bg-marca text-marca-fg font-bold px-7 py-3.5 rounded-xl hover:bg-marca-hover transition-colors"
              >
                Homologar mi carrera
                <ArrowRight className="w-[18px] h-[18px] transition-transform group-hover:translate-x-0.5" />
              </Link>
              {tieneSesion && (
                <Link
                  href="/mis-homologaciones"
                  className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-7 py-3.5 rounded-xl hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                >
                  Ver mis homologaciones
                </Link>
              )}
            </motion.div>

            <motion.p
              {...entra(0.24)}
              className="mt-5 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Gratis, sin crear cuenta y con revisión de un asesor.
            </motion.p>
          </div>

          {/* ── Columna de la tesis: una equivalencia real ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <FichaEquivalencia />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// La ficha que demuestra el producto: una competencia de origen y las asignaturas que cubre. Los
// números son los de un caso real del SENA (una competencia amplia cubre VARIAS asignaturas), no
// cifras de adorno.
function FichaEquivalencia() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] overflow-hidden">
      {/* Lo que trae el estudiante */}
      <div className="p-5 sm:p-6">
        <p className="etiqueta-registro">Traes</p>
        <p className="mt-2.5 text-lg leading-snug text-slate-900 dark:text-slate-100">
          {EQUIVALENCIA.origen.nombre}
        </p>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          {EQUIVALENCIA.origen.fuente} · {EQUIVALENCIA.origen.meta}
        </p>
      </div>

      {/* La bisagra: el signo de equivalencia. Es el símbolo del producto entero. */}
      <div className="relative flex items-center gap-3 px-5 sm:px-6">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span
          aria-hidden
          className="text-xl leading-none text-marca select-none"
          title="equivale a"
        >
          ≡
        </span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* A qué equivale */}
      <div className="p-5 sm:p-6">
        <p className="etiqueta-registro">Se te homologa</p>
        <ul className="mt-3 space-y-2.5">
          {EQUIVALENCIA.destino.map((a, i) => (
            <motion.li
              key={a.nombre}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.5 + i * 0.11, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3"
            >
              <span className="flex-1 text-[15px] font-medium text-slate-800 dark:text-slate-200">
                {a.nombre}
              </span>
              <span className="text-[13px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                {a.creditos} cr
              </span>
              {/* La similitud como barra + número: el asesor la lee de un vistazo y el estudiante
                  entiende que no es un sí/no, sino un grado de cobertura. */}
              <span className="flex items-center gap-2 shrink-0 w-[5.5rem] justify-end">
                <span className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${a.similitud}%` }}
                    transition={{ duration: 0.7, delay: 0.6 + i * 0.11, ease: [0.22, 1, 0.36, 1] }}
                    className="block h-full rounded-full bg-marca"
                  />
                </span>
                <span className="text-[13px] font-bold tabular-nums text-marca">{a.similitud}%</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Pie: la promesa que cierra el producto. */}
      <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
          Propuesta por el sistema · <span className="font-semibold text-slate-700 dark:text-slate-300">confirma un asesor</span>
        </p>
      </div>
    </div>
  );
}
