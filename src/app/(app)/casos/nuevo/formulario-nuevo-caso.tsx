"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import {
  IconCloudUpload as UploadCloud,
  IconFileText as FileText,
  IconCircleCheck as CheckCircle2,
  IconChevronRight as ChevronRight,
  IconBriefcase as Briefcase,
  IconSchool as School,
  IconBook as Book,
  IconUser as User,
  IconId as Id,
  IconMapPin as MapPin,
  IconPhone as Phone,
  IconMail as Mail,
  IconPaperclip as Paperclip,
  IconCalendar as Calendar,
  IconFiles as Files,
  IconX as X,
} from "@tabler/icons-react";
import clsx from "clsx";

import type { Pensum } from "@/types";
import { SelectorInstitucion } from "@/app/(app)/homologar/selector-institucion";
import { SelectorCarrera } from "@/app/(app)/homologar/selector-carrera";
import { crearCasoCoordinador, type EstadoCrearCaso } from "./acciones";

type PensumOpcion = Pick<Pensum, "id" | "carrera" | "version">;

const TAMANO_MAXIMO = 15 * 1024 * 1024;

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 bg-marca text-marca-fg px-8 py-3.5 rounded-xl font-bold hover:bg-marca-hover disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-marca/20"
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Procesando expediente con IA...
        </>
      ) : (
        <>
          Registrar expediente e iniciar análisis
          <ChevronRight className="w-5 h-5" />
        </>
      )}
    </button>
  );
}

function TituloSeccion({ numero, titulo, descripcion }: { numero: number; titulo: string; descripcion?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-bold">
          {numero}
        </span>
        {titulo}
      </h2>
      {descripcion && (
        <p className="text-xs text-slate-500 dark:text-slate-400 pl-8">
          {descripcion}
        </p>
      )}
    </div>
  );
}

export function FormularioNuevoCaso({ pensums }: { pensums: PensumOpcion[] }) {
  const [estado, accion] = useFormState<EstadoCrearCaso, FormData>(
    crearCasoCoordinador,
    null,
  );
  const router = useRouter();

  const inputCertificado = useRef<HTMLInputElement>(null);
  const [archivoCert, setArchivoCert] = useState<File | null>(null);
  const [errorCert, setErrorCert] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const inputDocs = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<File[]>([]);

  useEffect(() => {
    if (!estado) return;
    if ("error" in estado) {
      sileo.error({ title: "Error al registrar caso", description: estado.error });
    } else if ("aviso" in estado) {
      sileo.info({ title: "Caso registrado", description: estado.aviso });
      router.push(`/casos/${estado.casoId}`);
    }
  }, [estado, router]);

  function revisarCertificado(archivo: File | null) {
    setErrorCert(null);
    if (!archivo) {
      setArchivoCert(null);
      return;
    }
    if (archivo.type !== "application/pdf") {
      setErrorCert("El certificado de notas debe ser un archivo PDF.");
      setArchivoCert(null);
      if (inputCertificado.current) inputCertificado.current.value = "";
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setErrorCert("El PDF no puede superar los 15 MB.");
      setArchivoCert(null);
      if (inputCertificado.current) inputCertificado.current.value = "";
      return;
    }
    setArchivoCert(archivo);
  }

  function alSoltarCert(evento: React.DragEvent<HTMLLabelElement>) {
    evento.preventDefault();
    setArrastrando(false);
    const soltados = evento.dataTransfer.files;
    if (soltados.length > 0 && inputCertificado.current) {
      inputCertificado.current.files = soltados;
      revisarCertificado(soltados[0]);
    }
  }

  const inputEstilo =
    "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium text-sm";

  return (
    <form action={accion} className="space-y-8">
      {/* Sección 1: Datos del aspirante */}
      <section className="space-y-4">
        <TituloSeccion
          numero={1}
          titulo="Identificación del aspirante"
          descripcion="Datos legales del aspirante requeridos para la Resolución oficial de homologación."
        />

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="nombre" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Nombre completo *
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                required
                placeholder="Ej.: Juan Alexander Pérez Urbano"
                className={inputEstilo}
              />
            </div>

            <div>
              <label htmlFor="cedula" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Id className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Cédula / Documento de identidad *
              </label>
              <input
                id="cedula"
                name="cedula"
                type="text"
                required
                placeholder="Ej.: 1061789456"
                className={inputEstilo}
              />
            </div>

            <div>
              <label htmlFor="lugar_expedicion" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Lugar de expedición del documento *
              </label>
              <input
                id="lugar_expedicion"
                name="lugar_expedicion"
                type="text"
                required
                placeholder="Ej.: Popayán (Cauca)"
                className={inputEstilo}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label htmlFor="correo" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Correo electrónico{" "}
                <span className="font-normal text-slate-400">(opcional para notificarle)</span>
              </label>
              <input
                id="correo"
                name="correo"
                type="email"
                placeholder="aspirante@ejemplo.com"
                className={inputEstilo}
              />
            </div>

            <div>
              <label htmlFor="celular" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Celular / WhatsApp{" "}
                <span className="font-normal text-slate-400">(opcional para contacto)</span>
              </label>
              <input
                id="celular"
                name="celular"
                type="tel"
                placeholder="Ej.: 312 345 6789"
                className={inputEstilo}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sección 2: Procedencia académica y carrera destino */}
      <section className="space-y-4">
        <TituloSeccion
          numero={2}
          titulo="Procedencia académica y programa destino"
          descripcion="Define el plan de estudios destino de la Autónoma y los antecedentes del estudiante."
        />

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Carrera de la Autónoma del Cauca (destino) *
              </label>
              <SelectorCarrera pensums={pensums} name="pensum" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Institución de educación superior de origen *
              </label>
              <SelectorInstitucion name="institucion" />
            </div>
          </div>

          <div>
            <label htmlFor="programa_origen" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Book className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Programa o carrera de procedencia *
            </label>
            <input
              id="programa_origen"
              name="programa_origen"
              type="text"
              required
              placeholder="Ej.: Tecnología en Análisis y Desarrollo de Software (ADSO) o Ingeniería de Sistemas"
              className={inputEstilo}
            />
          </div>
        </div>
      </section>

      {/* Sección 3: Documentación oficial adjunta */}
      <section className="space-y-4">
        <TituloSeccion
          numero={3}
          titulo="Expediente de documentos (PDF)"
          descripcion="El certificado oficial de notas es obligatorio para extraer asignaturas. Los contenidos programáticos son opcionales pero recomendados."
        />

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
          {/* Certificado de notas */}
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              Certificado oficial de calificaciones (PDF) *
            </span>

            <input
              ref={inputCertificado}
              id="archivo-certificado"
              type="file"
              name="archivo"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => revisarCertificado(e.target.files?.[0] ?? null)}
            />

            <label
              htmlFor="archivo-certificado"
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltarCert}
              className={clsx(
                "rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition-all min-h-[160px] bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer",
                arrastrando
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
                  : archivoCert
                    ? "border-green-400 bg-green-50/20 dark:bg-green-500/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              )}
            >
              {archivoCert ? (
                <>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center mb-2 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate max-w-sm">
                    {archivoCert.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {(archivoCert.size / 1024 / 1024).toFixed(2)} MB · Clic para reemplazar
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-2 text-blue-600 dark:text-blue-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-0.5">
                    Arrastra el certificado aquí o haz clic para seleccionarlo
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Máximo 15 MB · Solo archivos PDF oficiales
                  </p>
                </>
              )}
            </label>
            {errorCert && <p className="text-xs font-semibold text-rose-500 mt-1.5">{errorCert}</p>}
          </div>

          {/* Contenidos programáticos */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Contenidos programáticos o syllabi{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Programas de asignaturas que justifican la equivalencia de créditos y contenidos.
                </p>
              </div>

              <input
                ref={inputDocs}
                id="documentos-adjuntos"
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

              <button
                type="button"
                onClick={() => inputDocs.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {docs.length > 0 ? "Modificar adjuntos" : "Adjuntar PDFs"}
              </button>
            </div>

            {docs.length > 0 && (
              <ul className="space-y-1.5 mt-3">
                {docs.map((doc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate flex-1 font-medium">{doc.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {(doc.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setDocs([]);
                      if (inputDocs.current) inputDocs.current.value = "";
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-500 mt-1"
                  >
                    <X className="w-3 h-3" /> Limpiar adjuntos
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Sección 4: Datos proyectados de la resolución */}
      <section className="space-y-4">
        <TituloSeccion
          numero={4}
          titulo="Proyección de matrícula y resolución"
          descripcion="Datos para la emisión de la Resolución oficial (pueden ajustarse posteriormente en el estudio)."
        />

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="periodo_matricula" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Período de matrícula proyectado
            </label>
            <input
              id="periodo_matricula"
              name="periodo_matricula"
              type="text"
              placeholder="Ej.: 1P-2026"
              className={inputEstilo}
            />
          </div>

          <div>
            <label htmlFor="fecha_limite_pago" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Fecha límite pago matrícula
            </label>
            <input
              id="fecha_limite_pago"
              name="fecha_limite_pago"
              type="date"
              className={inputEstilo}
            />
          </div>

          <div>
            <label htmlFor="folios_solicitud" className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Files className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              Folios solicitud formal
            </label>
            <input
              id="folios_solicitud"
              name="folios_solicitud"
              type="number"
              min={1}
              defaultValue={1}
              className={inputEstilo}
            />
          </div>
        </div>
      </section>

      {/* Pie con botón de registrar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Al registrar, el sistema analizará el certificado con IA.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Podrás revisar la propuesta, vincular materias y generar la Resolución oficial.
          </p>
        </div>

        <BotonEnviar />
      </div>
    </form>
  );
}
