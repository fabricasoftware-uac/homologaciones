"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  IconCloudUpload as Upload,
  IconSparkles as Sparkles,
  IconCircleCheck as CheckCircle2,
  IconArrowRight as ArrowRight,
  IconX as X,
  IconHandStop as Hand,
} from "@tabler/icons-react";

// Onboarding del invitado (primera vez en /homologar): una bienvenida con los 3 pasos y luego un
// tour con coachmarks que resaltan el selector de carrera, el certificado y el envío. Se guarda en
// localStorage para no repetirlo. Los objetivos se ubican con [data-tour="..."] en el formulario.

const CLAVE = "onboarding-homologar-v1";

const BIENVENIDA = [
  { icono: Upload, titulo: "Sube tu certificado", texto: "Tu certificado de notas en PDF." },
  { icono: Sparkles, titulo: "La IA lo analiza", texto: "Te propone qué materias se homologan." },
  { icono: CheckCircle2, titulo: "Recibe tu resultado", texto: "Un asesor lo confirma y te avisa." },
];

const TOUR = [
  {
    selector: '[data-tour="carrera"]',
    titulo: "1. Elige tu carrera",
    texto: "Selecciona el programa de la institución al que te quieres homologar. Puedes buscarlo por nombre.",
  },
  {
    selector: '[data-tour="certificado"]',
    titulo: "2. Sube tu certificado",
    texto: "Arrastra o elige tu certificado de notas en PDF. Es lo que analizamos para proponerte la homologación.",
  },
  {
    selector: '[data-tour="enviar"]',
    titulo: "3. Autoriza y envía",
    texto: "Marca la autorización de tratamiento de datos y envía. En minutos verás tu estimación.",
  },
];

export function OnboardingHomologar() {
  const [fase, setFase] = useState<"bienvenida" | "tour" | null>(null);
  const [paso, setPaso] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    try {
      if (!localStorage.getItem(CLAVE)) setFase("bienvenida");
    } catch {
      /* localStorage no disponible: no mostramos el onboarding */
    }
  }, []);

  // Calcula y mantiene la posición del elemento resaltado en el paso actual del tour.
  useEffect(() => {
    if (fase !== "tour") return;
    const objetivo = document.querySelector(TOUR[paso].selector) as HTMLElement | null;
    if (!objetivo) {
      setRect(null);
      return;
    }
    objetivo.scrollIntoView({ behavior: "smooth", block: "center" });
    const actualizar = () => setRect(objetivo.getBoundingClientRect());
    actualizar();
    window.addEventListener("resize", actualizar);
    window.addEventListener("scroll", actualizar, true);
    const t = setTimeout(actualizar, 350); // tras el scroll suave
    return () => {
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("scroll", actualizar, true);
      clearTimeout(t);
    };
  }, [fase, paso]);

  function cerrar() {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      /* ignore */
    }
    setFase(null);
  }

  function siguiente() {
    if (paso < TOUR.length - 1) setPaso((p) => p + 1);
    else cerrar();
  }

  if (!montado || fase === null) return null;

  // --- Bienvenida ---
  if (fase === "bienvenida") {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={cerrar}
        />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
        >
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-marca bg-marca/10 px-3 py-1.5 rounded-full">
            <Hand className="w-3.5 h-3.5" /> Bienvenido
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">
            Homologa tu carrera en 3 pasos
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Es gratis y no necesitas crear cuenta. Te mostramos cómo.
          </p>

          <div className="mt-5 space-y-3">
            {BIENVENIDA.map((b, i) => (
              <div key={b.titulo} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-marca/10 text-marca flex items-center justify-center shrink-0">
                  <b.icono className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    <span className="text-slate-400 dark:text-slate-500">{i + 1}.</span> {b.titulo}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{b.texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={cerrar}
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Saltar
            </button>
            <button
              type="button"
              onClick={() => {
                setPaso(0);
                setFase("tour");
              }}
              className="inline-flex items-center gap-2 bg-marca text-marca-fg font-bold px-5 py-2.5 rounded-xl hover:bg-marca-hover transition-colors"
            >
              Empezar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>,
      document.body,
    );
  }

  // --- Tour con coachmarks ---
  if (fase === "tour") {
    if (!rect) {
      // El objetivo no está visible aún; un velo simple con opción de saltar.
      return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/40" onClick={cerrar} />,
        document.body,
      );
    }

    const pad = 8;
    const hueco = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    // El tooltip va debajo si el objetivo está en la mitad superior; si no, arriba.
    const abajo = rect.top + rect.height / 2 < window.innerHeight / 2;
    const t = TOUR[paso];

    return createPortal(
      <div className="fixed inset-0 z-[100]">
        {/* Spotlight: el "hueco" tapa todo menos el objetivo con un box-shadow gigante. */}
        <div
          className="absolute rounded-xl ring-2 ring-marca transition-all duration-300 pointer-events-none"
          style={{
            top: hueco.top,
            left: hueco.left,
            width: hueco.width,
            height: hueco.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65)",
          }}
        />
        {/* Capa para cerrar al clicar fuera (sin tapar el objetivo). */}
        <div className="absolute inset-0" onClick={cerrar} />

        {/* Tooltip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={paso}
            initial={{ opacity: 0, y: abajo ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4"
            style={{
              top: abajo ? hueco.top + hueco.height + 12 : undefined,
              bottom: abajo ? undefined : window.innerHeight - hueco.top + 12,
              left: Math.min(
                Math.max(rect.left, 16),
                window.innerWidth - Math.min(320, window.innerWidth - 32) - 16,
              ),
            }}
          >
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.titulo}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t.texto}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {TOUR.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === paso
                        ? "w-5 h-1.5 rounded-full bg-marca transition-all"
                        : "w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 transition-all"
                    }
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cerrar}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={siguiente}
                  className="inline-flex items-center gap-1.5 bg-marca text-marca-fg text-sm font-bold px-3.5 py-1.5 rounded-lg hover:bg-marca-hover transition-colors"
                >
                  {paso < TOUR.length - 1 ? "Siguiente" : "Listo"}
                  {paso < TOUR.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>,
      document.body,
    );
  }

  return null;
}
