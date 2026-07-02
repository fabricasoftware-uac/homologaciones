import Link from "next/link";
import {
  IconCloudUpload as Upload,
  IconSparkles as Sparkles,
  IconCircleCheck as CheckCircle2,
  IconArrowRight as ArrowRight,
  IconClipboardList as ClipboardList,
} from "@tabler/icons-react";

import type { Configuracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";
import { BotonTema } from "@/components/boton-tema";
import { LandingHero } from "@/components/landing-hero";
import { Revelar } from "@/components/landing-anim";

// Landing pública (en /). Es la primera cara para el estudiante: explica qué hace la plataforma y lo
// invita a homologar. White-label: toma el nombre, el logo y los colores de la institución. El admin
// no la ve (el home lo redirige a /inicio). Soporta modo claro/oscuro. El hero y los reveals al
// scroll son client components (LandingHero / Revelar); el resto es server.

const PASOS = [
  {
    icono: Upload,
    titulo: "Sube tu certificado",
    texto: "Adjunta tu certificado de notas en PDF y, si los tienes, los contenidos de las materias.",
  },
  {
    icono: Sparkles,
    titulo: "La IA lo analiza",
    texto: "Comparamos tus materias con el plan de estudios y proponemos qué se te puede homologar.",
  },
  {
    icono: CheckCircle2,
    titulo: "Recibe tu resultado",
    texto: "Un asesor revisa tu caso y te avisamos el semestre al que ingresarías, con tu acta lista.",
  },
];

const FAQ = [
  {
    p: "¿Cuánto cuesta hacer la consulta?",
    r: "La estimación de homologación es gratuita. Solo subes tu certificado y recibes el resultado.",
  },
  {
    p: "¿Necesito crear una cuenta?",
    r: "No. Envías tu solicitud como invitado y te damos un enlace para seguir su estado por correo.",
  },
  {
    p: "¿Qué documentos necesito?",
    r: "Tu certificado de notas oficial en PDF. Los contenidos programáticos (syllabi) son opcionales pero agilizan la revisión.",
  },
  {
    p: "¿El resultado es definitivo?",
    r: "La estimación inicial la hace la IA; un asesor de la institución la revisa y confirma el resultado oficial.",
  },
];

export function Landing({
  marca,
  tieneSesion,
  carreras,
}: {
  marca: Configuracion;
  tieneSesion: boolean;
  carreras: number;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* Barra superior */}
      <header className="border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Logotipo marca={marca} size="sm" />
          <span className="font-bold tracking-tight truncate">{marca.nombre}</span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {tieneSesion && (
              <Link
                href="/mis-homologaciones"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2"
              >
                <ClipboardList className="w-4 h-4" /> Mis homologaciones
              </Link>
            )}
            {/* El acceso de administradores/asesores NO se muestra en la landing pública: se entra por
                la URL directa /ingresar. Así el estudiante solo ve el flujo de homologación. */}
            <BotonTema className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2" />
          </div>
        </div>
      </header>

      {/* Hero animado (spotlight + orbes + contadores) */}
      <LandingHero marca={marca} tieneSesion={tieneSesion} carreras={carreras} />

      {/* Cómo funciona */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <Revelar>
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">Cómo funciona</h2>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2">Tres pasos, sin trámites largos.</p>
          </Revelar>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PASOS.map((paso, i) => (
              <Revelar
                key={paso.titulo}
                delay={i * 0.1}
                className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6"
              >
                <span className="absolute top-5 right-5 text-3xl font-extrabold text-slate-100 dark:text-slate-800">
                  {i + 1}
                </span>
                <div className="w-12 h-12 rounded-xl bg-marca/10 text-marca flex items-center justify-center">
                  <paso.icono className="w-6 h-6" />
                </div>
                <h3 className="mt-4 font-bold text-lg">{paso.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{paso.texto}</p>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <Revelar>
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.p}
                className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                <summary className="cursor-pointer list-none px-5 py-4 font-semibold flex items-center justify-between gap-3">
                  {item.p}
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-5 pb-4 -mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.r}</p>
              </details>
            ))}
          </div>
        </Revelar>
      </section>

      {/* CTA final */}
      <section className="bg-slate-900 dark:bg-slate-900 dark:border-t dark:border-slate-800 text-white">
        <Revelar className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ¿Listo para conocer tu homologación?
          </h2>
          <Link
            href="/homologar"
            className="mt-7 inline-flex items-center gap-2 bg-marca text-marca-fg font-bold px-7 py-3.5 rounded-xl hover:bg-marca-hover transition-colors"
          >
            Empezar ahora <ArrowRight className="w-5 h-5" />
          </Link>
        </Revelar>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400 dark:text-slate-500">
          <span>
            © {new Date().getFullYear()} {marca.nombre}
          </span>
          <Link href="/privacidad" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">
            Política de tratamiento de datos
          </Link>
        </div>
      </footer>
    </div>
  );
}
