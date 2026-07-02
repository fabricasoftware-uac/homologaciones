"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { sileo } from "sileo";
import {
  IconCloudUpload as UploadCloud,
  IconFileText as FileText,
  IconCircleCheck as CheckCircle2,
  IconChevronRight as ChevronRight,
  IconBriefcase as Briefcase,
  IconSchool as School,
  IconUser as User,
  IconPhone as Phone,
  IconMail as Mail,
  IconShieldCheck as ShieldCheck,
  IconPaperclip as Paperclip,
  IconX as X,
} from "@tabler/icons-react";
import clsx from "clsx";

import type { Pensum } from "@/types";
import { crearHomologacion, type EstadoHomologacion } from "./acciones";
import { SelectorInstitucion } from "./selector-institucion";
import { SelectorCarrera } from "./selector-carrera";

type PensumOpcion = Pick<Pensum, "id" | "carrera" | "version">;

const TAMANO_MAXIMO = 10 * 1024 * 1024;

// Site key (público) del captcha. Si no está configurado, no mostramos el widget y el servidor omite
// la verificación: el formulario sigue funcionando, solo sin captcha.
const SITE_KEY_CAPTCHA = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Turnstile invoca funciones globales por nombre cuando resuelve o expira el desafío.
declare global {
  interface Window {
    onCaptchaOk?: () => void;
    onCaptchaExpira?: () => void;
  }
}

function BotonEnviar({ bloqueado }: { bloqueado: boolean }) {
  const { pending } = useFormStatus();
  const deshabilitado = pending || bloqueado;
  return (
    <button
      type="submit"
      disabled={deshabilitado}
      className="flex items-center justify-center gap-2 bg-marca text-marca-fg px-8 py-3.5 rounded-xl font-bold hover:bg-marca-hover disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed transition-all shadow-lg shadow-marca/20"
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Analizando tu certificado...
        </>
      ) : (
        <>
          Enviar solicitud
          <ChevronRight className="w-5 h-5" />
        </>
      )}
    </button>
  );
}

// Encabezado numerado de cada paso del formulario.
function PasoTitulo({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs">
        {numero}
      </span>
      {children}
    </h2>
  );
}

export function FormularioHomologacion({ pensums }: { pensums: PensumOpcion[] }) {
  const [estado, accion] = useFormState<EstadoHomologacion, FormData>(
    crearHomologacion,
    null,
  );
  const router = useRouter();
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Autorización de tratamiento de datos (Habeas Data): obligatoria para poder enviar.
  const [autoriza, setAutoriza] = useState(false);
  // Documentos adicionales opcionales (contenidos programáticos / syllabi).
  const inputDocs = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<File[]>([]);

  // El botón de enviar se bloquea hasta que el captcha esté resuelto: evita envíos prematuros (la
  // causa más común de que "el captcha falle" es mandar el formulario antes de que el widget genere
  // su token). Si no hay captcha configurado, no bloqueamos nada.
  const captchaRequerido = !!SITE_KEY_CAPTCHA;
  const [captchaListo, setCaptchaListo] = useState(false);

  useEffect(() => {
    if (!captchaRequerido) return;
    window.onCaptchaOk = () => setCaptchaListo(true);
    window.onCaptchaExpira = () => setCaptchaListo(false);
    return () => {
      delete window.onCaptchaOk;
      delete window.onCaptchaExpira;
    };
  }, [captchaRequerido]);

  // Respuesta del servidor (useFormState entrega un objeto nuevo en cada envío, así que el efecto se
  // dispara aunque el mensaje se repita):
  //   - error  -> notificación roja (validación, tope diario, PDF rechazado por la IA).
  //   - aviso  -> la solicitud SÍ se registró pero la IA no estuvo disponible: lo anunciamos como
  //               info y llevamos al estudiante a su caso (el servidor no redirige en este camino).
  useEffect(() => {
    if (!estado) return;
    if ("error" in estado) {
      sileo.error({ title: "No pudimos enviar tu solicitud", description: estado.error });
    } else if ("aviso" in estado) {
      sileo.info({ title: "Recibimos tu solicitud", description: estado.aviso });
      router.push(`/mis-homologaciones/${estado.casoId}`);
    }
  }, [estado, router]);

  // Misma validación que la server action, pero aquí para dar respuesta inmediata. Si el archivo
  // no sirve, también limpiamos el input para que no termine viajando en el envío.
  function revisarArchivo(elegido: File | null) {
    setErrorArchivo(null);
    if (!elegido) {
      setArchivo(null);
      return;
    }
    if (elegido.type !== "application/pdf") {
      setErrorArchivo("El certificado debe ser un archivo PDF.");
      setArchivo(null);
      if (inputArchivo.current) inputArchivo.current.value = "";
      return;
    }
    if (elegido.size > TAMANO_MAXIMO) {
      setErrorArchivo("El PDF no puede pesar más de 10 MB.");
      setArchivo(null);
      if (inputArchivo.current) inputArchivo.current.value = "";
      return;
    }
    setArchivo(elegido);
  }

  function alSoltar(evento: React.DragEvent<HTMLLabelElement>) {
    evento.preventDefault();
    setArrastrando(false);
    const soltados = evento.dataTransfer.files;
    if (soltados.length > 0 && inputArchivo.current) {
      // Reflejamos el archivo soltado en el input para que viaje dentro del FormData al enviar.
      inputArchivo.current.files = soltados;
      revisarArchivo(soltados[0]);
    }
  }

  const inputClase =
    "w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium";

  return (
    <form action={accion} className="space-y-6">
      {/* Paso 1: quién eres. Lo pedimos primero porque es lo más simple y con esto te contactamos. */}
      <section className="space-y-4">
        <PasoTitulo numero={1}>Tus datos de contacto</PasoTitulo>
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
          Con estos datos te avisamos el resultado y te contactamos para confirmar tu homologación.
        </p>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="nombre" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              autoComplete="name"
              placeholder="Ej.: Ana Pérez"
              className={inputClase}
            />
          </div>

          <div>
            <label htmlFor="celular" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Celular
            </label>
            <input
              id="celular"
              name="celular"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="Ej.: 300 123 4567"
              className={inputClase}
            />
          </div>

          <div>
            <label htmlFor="correo" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Correo electrónico
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="Ej.: ana@correo.com"
              className={inputClase}
            />
          </div>
        </div>
      </section>

      {/* Paso 2: qué quieres homologar (carrera destino + universidad de origen). */}
      <section className="space-y-4">
        <PasoTitulo numero={2}>¿Qué quieres homologar?</PasoTitulo>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div data-tour="carrera">
            <label htmlFor="pensum" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Carrera de la Autónoma
            </label>
            <SelectorCarrera pensums={pensums} name="pensum" />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
              <School className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Tu universidad de origen
            </label>
            <SelectorInstitucion name="institucion" />
          </div>
        </div>
      </section>

      {/* Paso 3: el certificado de notas en PDF. */}
      <section className="space-y-4">
        <PasoTitulo numero={3}>Tu certificado de notas (PDF)</PasoTitulo>

        {/* El input vive una sola vez; el label (htmlFor) hace clickeable todo el recuadro. */}
        <input
          ref={inputArchivo}
          id="archivo-homologacion"
          type="file"
          name="archivo"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => revisarArchivo(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="archivo-homologacion"
          data-tour="certificado"
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={clsx(
            "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[200px] bg-white dark:bg-slate-900 shadow-sm cursor-pointer",
            arrastrando
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/12"
              : archivo
                ? "border-green-400 bg-green-50/30 dark:bg-green-500/12"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800",
          )}
        >
          {archivo ? (
            <>
              <div className="w-14 h-14 bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center mb-3 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate max-w-[250px]">
                {archivo.name}
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm">
                {(archivo.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <span className="mt-3 text-sm font-bold text-blue-600 dark:text-blue-400">
                Haz clic para cambiarlo
              </span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-3 text-blue-600 dark:text-blue-400 shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-1">Arrastra el PDF aquí</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-4">
                o <span className="text-blue-600 dark:text-blue-400 font-bold">explora tus archivos</span>
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                <FileText className="w-3.5 h-3.5" /> Máximo 10 MB · PDF
              </div>
            </>
          )}
        </label>
        {errorArchivo && <p className="text-sm font-medium text-destructive">{errorArchivo}</p>}
      </section>

      {/* Paso 4: contenidos programáticos (opcional). Varios PDFs; ayudan a sustentar la homologación. */}
      <section className="space-y-4">
        <PasoTitulo numero={4}>
          Contenidos programáticos{" "}
          <span className="text-sm font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
        </PasoTitulo>
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
          Si los tienes, adjunta los programas o syllabi de las materias que cursaste. Agilizan la
          revisión de tu homologación.
        </p>

        <input
          ref={inputDocs}
          id="documentos"
          type="file"
          name="documentos"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const elegidos = Array.from(e.target.files ?? []).filter(
              (f) => f.type === "application/pdf" && f.size <= TAMANO_MAXIMO,
            );
            setDocs(elegidos);
          }}
        />
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => inputDocs.current?.click()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-4 py-2.5 hover:bg-blue-100 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
            {docs.length > 0 ? "Cambiar documentos" : "Adjuntar documentos (PDF)"}
          </button>
          {docs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {docs.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5"
                >
                  <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate flex-1">{d.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {(d.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          )}
          {docs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDocs([]);
                if (inputDocs.current) inputDocs.current.value = "";
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" /> Quitar todos
            </button>
          )}
        </div>
      </section>

      {/* Autorización de tratamiento de datos (Ley 1581 / Habeas Data): obligatoria antes de enviar.
          El checkbox controlado viaja en el FormData como "autoriza" y el servidor lo re-valida. */}
      <label
        htmlFor="autoriza"
        data-tour="enviar"
        className="flex items-start gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer"
      >
        <input
          id="autoriza"
          name="autoriza"
          type="checkbox"
          checked={autoriza}
          onChange={(e) => setAutoriza(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-marca cursor-pointer"
        />
        <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Autorizo el tratamiento de mis datos personales conforme a la{" "}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-marca hover:underline"
          >
            Política de tratamiento de datos
          </a>{" "}
          para gestionar mi solicitud de homologación y ser contactado con el resultado.
        </span>
      </label>

      {/* Pie: verificación de seguridad + envío, juntos para que se entienda que uno habilita al otro. */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 min-h-[65px]">
          {captchaRequerido ? (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              {/* El widget inyecta el input oculto cf-turnstile-response dentro del form al resolverse. */}
              <div
                className="cf-turnstile"
                data-sitekey={SITE_KEY_CAPTCHA}
                data-callback="onCaptchaOk"
                data-expired-callback="onCaptchaExpira"
                data-error-callback="onCaptchaExpira"
              />
            </>
          ) : (
            <span className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-4 h-4" />
              Verificación de seguridad desactivada.
            </span>
          )}
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {estado && "error" in estado && (
            <p className="text-sm font-medium text-destructive sm:text-right">{estado.error}</p>
          )}
          {captchaRequerido && !captchaListo && (
            <p className="text-xs text-slate-400 dark:text-slate-500 sm:text-right">
              Completa la verificación de seguridad para enviar.
            </p>
          )}
          {!autoriza && (
            <p className="text-xs text-slate-400 dark:text-slate-500 sm:text-right">
              Autoriza el tratamiento de datos para enviar.
            </p>
          )}
          <BotonEnviar bloqueado={(captchaRequerido && !captchaListo) || !autoriza} />
        </div>
      </div>
    </form>
  );
}
