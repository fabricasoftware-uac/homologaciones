"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  ChevronRight,
  Briefcase,
  School,
} from "lucide-react";
import clsx from "clsx";

import type { Pensum } from "@/types";
import { crearHomologacion, type EstadoHomologacion } from "./acciones";

type PensumOpcion = Pick<Pensum, "id" | "carrera" | "version">;

const TAMANO_MAXIMO = 10 * 1024 * 1024;

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 bg-blue-800 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-800/20"
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Enviando solicitud...
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

export function FormularioHomologacion({ pensums }: { pensums: PensumOpcion[] }) {
  const [estado, accion] = useFormState<EstadoHomologacion, FormData>(
    crearHomologacion,
    null,
  );
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

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

  return (
    <form action={accion} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Columna 1: el certificado en PDF */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs">
              1
            </span>
            Certificado de notas (PDF)
          </h2>

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
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={alSoltar}
            className={clsx(
              "flex-1 rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[280px] bg-white shadow-sm cursor-pointer",
              arrastrando
                ? "border-blue-500 bg-blue-50/50"
                : archivo
                  ? "border-green-400 bg-green-50/30"
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
            )}
          >
            {archivo ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600 border border-green-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="font-bold text-slate-800 text-lg truncate max-w-[250px]">
                  {archivo.name}
                </p>
                <p className="text-slate-500 font-medium mt-1 text-sm">
                  {(archivo.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <span className="mt-4 text-sm font-bold text-blue-600">
                  Haz clic para cambiarlo
                </span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600 shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="font-bold text-slate-800 text-lg mb-2">
                  Arrastra el PDF aquí
                </p>
                <p className="text-slate-500 font-medium text-sm mb-6">
                  o <span className="text-blue-600 font-bold">explora tus archivos</span>
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                  <FileText className="w-3.5 h-3.5" /> Máximo 10 MB · PDF
                </div>
              </>
            )}
          </label>
        </div>

        {/* Columna 2: los detalles de la solicitud */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs">
              2
            </span>
            Detalles de la homologación
          </h2>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5 flex-1">
            <div>
              <label
                htmlFor="pensum"
                className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"
              >
                <Briefcase className="w-4 h-4 text-blue-600" />
                Carrera que quieres homologar
              </label>
              <select
                id="pensum"
                name="pensum"
                required
                defaultValue=""
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 font-medium"
              >
                <option value="" disabled>
                  Selecciona un programa académico...
                </option>
                {pensums.map((pensum) => (
                  <option key={pensum.id} value={pensum.id}>
                    {pensum.carrera} ({pensum.version})
                  </option>
                ))}
              </select>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <label
                htmlFor="institucion"
                className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"
              >
                <School className="w-4 h-4 text-slate-400" />
                Tu universidad de origen
              </label>
              <input
                id="institucion"
                name="institucion"
                type="text"
                required
                placeholder="Ej.: Universidad del Cauca"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        {(errorArchivo ?? estado?.error) && (
          <p className="text-sm font-medium text-destructive">
            {errorArchivo ?? estado?.error}
          </p>
        )}
        <BotonEnviar />
      </div>
    </form>
  );
}
