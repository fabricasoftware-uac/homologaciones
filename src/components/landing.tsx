import Link from "next/link";
import {
  IconCloudUpload as Upload,
  IconSparkles as Sparkles,
  IconCircleCheck as CheckCircle2,
  IconArrowRight as ArrowRight,
  IconClipboardList as ClipboardList,
  IconFileText as FileText,
  IconScan as Scan,
  IconMail as Mail,
  IconQrcode as Qrcode,
  IconShieldCheck as ShieldCheck,
  IconClock as Clock,
  IconSchool as GraduationCap,
  IconUserCheck as UserCheck,
} from "@tabler/icons-react";

import type { Configuracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";
import { BotonTema } from "@/components/boton-tema";
import { LandingHero } from "@/components/landing-hero";
import { Revelar } from "@/components/landing-anim";
import { IlustracionEstudio } from "@/components/landing-ilustracion";

// Landing pública (en /). Es la primera cara para el estudiante: explica qué hace la plataforma y lo
// invita a homologar. White-label: toma el nombre, el logo y los colores de la institución. El admin
// no la ve (el home lo redirige a /inicio). Soporta modo claro/oscuro. El hero, los reveals al
// scroll y la ilustración animada del estudio son client components; el resto es server.

const PASOS = [
  {
    icono: Upload,
    titulo: "Sube tu certificado",
    texto: "Adjunta tu certificado de notas en PDF y cuéntanos de qué universidad vienes.",
    detalles: ["Sirve con texto o escaneado", "Syllabi opcionales para agilizar"],
  },
  {
    icono: Sparkles,
    titulo: "La IA lo analiza",
    texto: "Extraemos tus materias y las comparamos una a una contra el plan de estudios destino.",
    detalles: ["Equivalencias con % de similitud", "Semestre estimado por créditos"],
  },
  {
    icono: CheckCircle2,
    titulo: "Recibe tu resultado",
    texto: "Un asesor revisa la propuesta, confirma el veredicto y te avisamos por correo.",
    detalles: ["Revisión humana siempre", "Acta en PDF con QR verificable"],
  },
];

// La sección de profundidad: qué hace el sistema por dentro, con detalles reales (no humo).
const DETALLES = [
  {
    icono: FileText,
    titulo: "Lee tu certificado como un asesor",
    texto:
      "No es un formulario más: el sistema entiende tu historial académico. Reconoce cada materia con su nota, créditos y semestre, sin que tengas que transcribir nada.",
    puntos: [
      "Extrae materias, notas y créditos automáticamente",
      "¿Certificado escaneado o foto en PDF? Lo leemos con visión por computador",
      "Valida que el documento sea un certificado académico real",
    ],
    ficha: [
      { icono: FileText, texto: "Materias y notas" },
      { icono: Scan, texto: "OCR para escaneados" },
      { icono: ShieldCheck, texto: "Documento validado" },
    ],
  },
  {
    icono: Sparkles,
    titulo: "Cada equivalencia, explicada",
    texto:
      "La IA no decide a ciegas: propone cada vínculo con un porcentaje de similitud y la razón de la equivalencia, y estima tu semestre según los créditos que ya cubriste.",
    puntos: [
      "“Cálculo I” encuentra a “Cálculo Diferencial” aunque no se llamen igual",
      "Cada vínculo trae su % de confianza y su justificación",
      "El semestre sugerido se calcula con la carga real del plan",
    ],
    ficha: [
      { icono: Sparkles, texto: "Similitud 55–100%" },
      { icono: GraduationCap, texto: "Semestre sugerido" },
      { icono: UserCheck, texto: "Confirmado por asesor" },
    ],
  },
  {
    icono: Qrcode,
    titulo: "Un resultado que puedes mostrar",
    texto:
      "Al aprobarse tu caso recibes un acta en PDF con código QR: cualquier persona puede escanearlo y verificar tu homologación en línea. Y sigues tu caso sin crear cuenta.",
    puntos: [
      "Enlace de seguimiento privado que llega a tu correo",
      "Acta oficial en PDF con QR de verificación",
      "Te avisamos cada avance: recibido, en revisión y veredicto",
    ],
    ficha: [
      { icono: Mail, texto: "Seguimiento por correo" },
      { icono: Qrcode, texto: "Acta con QR" },
      { icono: Clock, texto: "Avisos en cada paso" },
    ],
  },
];

const CONFIANZA = [
  { icono: ShieldCheck, texto: "Datos protegidos (Habeas Data)" },
  { icono: Clock, texto: "Estimación en minutos" },
  { icono: UserCheck, texto: "Revisión humana del resultado" },
  { icono: Mail, texto: "Seguimiento sin crear cuenta" },
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
    p: "¿Sirve si mi certificado está escaneado?",
    r: "Sí. Si tu PDF es un escaneo o una foto, lo leemos con visión por computador (OCR) y extraemos tus materias igual.",
  },
  {
    p: "¿Qué documentos necesito?",
    r: "Tu certificado de notas oficial en PDF. Los contenidos programáticos (syllabi) son opcionales pero agilizan la revisión.",
  },
  {
    p: "¿El resultado es definitivo?",
    r: "La estimación inicial la hace la IA; un asesor de la institución la revisa y confirma el resultado oficial. El acta aprobada trae un QR para verificarla.",
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
      {/* Barra superior: pegajosa y translúcida, con anclas a las secciones (solo escritorio). */}
      <header className="sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Logotipo marca={marca} size="sm" />
          <span className="font-bold tracking-tight truncate">{marca.nombre}</span>
          <nav className="ml-6 hidden md:flex items-center gap-5 text-sm font-medium text-slate-500 dark:text-slate-400">
            <a href="#como-funciona" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Cómo funciona
            </a>
            <a href="#detalle" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Qué hay detrás
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Preguntas
            </a>
          </nav>
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

      {/* "Product shot": la ilustración animada del estudio, el ancla visual de la página. */}
      <section className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <IlustracionEstudio />
        <Revelar delay={0.15}>
          <p className="mt-5 text-center text-sm text-slate-400 dark:text-slate-500">
            Así se ve tu estimación: cada materia tuya, enlazada con su equivalente del plan.
          </p>
        </Revelar>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <Revelar>
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">Cómo funciona</h2>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2">
              Tres pasos, sin filas ni trámites largos.
            </p>
          </Revelar>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PASOS.map((paso, i) => (
              <Revelar
                key={paso.titulo}
                delay={i * 0.1}
                className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-shadow hover:shadow-md"
              >
                <span className="absolute top-5 right-5 text-3xl font-extrabold text-slate-100 dark:text-slate-800 select-none">
                  {i + 1}
                </span>
                <div className="w-12 h-12 rounded-xl bg-marca/10 text-marca flex items-center justify-center">
                  <paso.icono className="w-6 h-6" />
                </div>
                <h3 className="mt-4 font-bold text-lg">{paso.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{paso.texto}</p>
                <ul className="mt-4 space-y-1.5">
                  {paso.detalles.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {d}
                    </li>
                  ))}
                </ul>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* Qué hay detrás: la profundidad del sistema, en filas alternadas texto <-> ficha visual. */}
      <section id="detalle" className="scroll-mt-20 max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <Revelar>
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Qué hay detrás de tu estimación
          </h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mt-2 max-w-xl mx-auto">
            No es magia: es un sistema que lee, compara y explica cada decisión — y una persona que la confirma.
          </p>
        </Revelar>
        <div className="mt-12 space-y-14">
          {DETALLES.map((bloque, i) => (
            <Revelar key={bloque.titulo} delay={0.05}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Texto (alterna de lado en escritorio). */}
                <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                  <div className="w-11 h-11 rounded-xl bg-marca/10 text-marca flex items-center justify-center">
                    <bloque.icono className="w-6 h-6" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">{bloque.titulo}</h3>
                  <p className="mt-2 text-slate-500 dark:text-slate-400 leading-relaxed">{bloque.texto}</p>
                  <ul className="mt-4 space-y-2">
                    {bloque.puntos.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Ficha visual: chips grandes con los conceptos del bloque. */}
                <div className={i % 2 === 1 ? "md:order-1" : undefined}>
                  <div className="relative">
                    <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-marca/10 via-transparent to-acento/10 blur-xl" />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
                      {bloque.ficha.map((f, j) => (
                        <div
                          key={f.texto}
                          className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3"
                        >
                          <span
                            className={
                              j === 1
                                ? "w-9 h-9 rounded-lg bg-acento/10 text-acento flex items-center justify-center shrink-0"
                                : "w-9 h-9 rounded-lg bg-marca/10 text-marca flex items-center justify-center shrink-0"
                            }
                          >
                            <f.icono className="w-5 h-5" />
                          </span>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{f.texto}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Revelar>
          ))}
        </div>
      </section>

      {/* Franja de confianza */}
      <section className="border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <Revelar className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {CONFIANZA.map((c) => (
            <div key={c.texto} className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
              <c.icono className="w-5 h-5 text-marca shrink-0" />
              {c.texto}
            </div>
          ))}
        </Revelar>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
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

      {/* CTA final: banda con el degradado de la marca. */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg, var(--marca), var(--acento))" }}
      >
        <div className="pointer-events-none absolute -top-20 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-black/10 blur-3xl" />
        <Revelar className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ¿Listo para conocer tu homologación?
          </h2>
          <p className="mt-3 text-white/80 max-w-md mx-auto">
            Sube tu certificado y en minutos sabrás qué materias te valen y a qué semestre entrarías.
          </p>
          <Link
            href="/homologar"
            className="mt-8 inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-black/10 hover:bg-slate-100 transition-colors"
          >
            Empezar ahora <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm text-white/70 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Gratis, sin crear cuenta
          </p>
        </Revelar>
      </section>

      {/* Footer completo: marca + navegación + legal, con barra final. */}
      <footer className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-10">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-3">
              <Logotipo marca={marca} size="sm" />
              <span className="font-bold tracking-tight">{marca.nombre}</span>
            </div>
            {marca.eslogan && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                {marca.eslogan}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
              Homologa tu carrera en línea: la IA propone, un asesor confirma y tú recibes tu acta verificable.
            </p>
          </div>

          {/* Explora */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
              Explora
            </p>
            <ul className="space-y-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              <li>
                <Link href="/homologar" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Homologar mi carrera
                </Link>
              </li>
              {tieneSesion && (
                <li>
                  <Link href="/mis-homologaciones" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Mis homologaciones
                  </Link>
                </li>
              )}
              <li>
                <a href="#como-funciona" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Cómo funciona
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Preguntas frecuentes
                </a>
              </li>
            </ul>
          </div>

          {/* Legal y ayuda */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
              Legal y ayuda
            </p>
            <ul className="space-y-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              <li>
                <Link href="/privacidad" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Política de tratamiento de datos
                </Link>
              </li>
              <li className="flex items-start gap-2 text-slate-400 dark:text-slate-500">
                <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                <span>El enlace de seguimiento de tu caso llega a tu correo al enviarlo.</span>
              </li>
              <li className="flex items-start gap-2 text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Tus datos se usan solo para gestionar tu homologación.</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
            <span>
              © {new Date().getFullYear()} {marca.nombre}. Todos los derechos reservados.
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Homologación asistida por IA, confirmada por personas.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
