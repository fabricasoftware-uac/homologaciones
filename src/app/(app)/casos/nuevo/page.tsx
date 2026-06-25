"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, CheckCircle2, ChevronRight, User, School, Briefcase, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import clsx from "clsx";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function NuevoCasoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [sourceInstitution, setSourceInstitution] = useState("");
  const [targetCareer, setTargetCareer] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      if (!studentName) setStudentName("Estudiante Nuevo");
      if (!sourceInstitution) setSourceInstitution("Institución de Origen (Auto-detectada)");
    }
  };

  const handleStartAnalysis = () => {
    if (!file || !targetCareer) return;
    setIsAnalyzing(true);

    setTimeout(() => {
      router.push(`/casos/nuevo-${Date.now()}`);
    }, 1500);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 relative">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 sticky top-0 z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/casos")}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Nuevo Caso de Homologación</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sube el certificado de notas y configura los detalles del estudio.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs">1</span>
                Certificado de Notas (PDF)
              </h2>

              <div
                className={clsx(
                  "flex-1 rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center transition-all duration-300 min-h-[300px] bg-white dark:bg-slate-900 shadow-sm",
                  isDragging ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/12 scale-[1.02]" : file ? "border-green-400 bg-green-50/30 dark:bg-green-500/12" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="text-center flex flex-col items-center w-full">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-500/30">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate max-w-[250px]">{file.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                    <button
                      type="button"
                      className="mt-6 px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
                      onClick={() => setFile(null)}
                    >
                      Cambiar Archivo
                    </button>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-2">Arrastra el PDF aquí</p>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-6">
                      o{" "}
                      <label className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer hover:underline underline-offset-4">
                        explora tus archivos
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setFile(e.target.files[0]);
                              if (!studentName) setStudentName("Estudiante Nuevo");
                              if (!sourceInstitution) setSourceInstitution("Institución de Origen (Auto-detectada)");
                            }
                          }}
                        />
                      </label>
                    </p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                      <FileText className="w-3.5 h-3.5" /> Max 20MB
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-4"
            >
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs">2</span>
                Detalles de Homologación
              </h2>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-5 flex-1">

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Carrera Destino (Aplica a)
                  </label>
                  <Select value={targetCareer} onValueChange={setTargetCareer}>
                    <SelectTrigger className="w-full !h-auto px-4 py-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-medium">
                      <SelectValue placeholder="Selecciona un programa académico..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Contaduría Pública">Contaduría Pública</SelectItem>
                      <SelectItem value="Ingeniería de Sistemas">Ingeniería de Sistemas</SelectItem>
                      <SelectItem value="Administración de Empresas">Administración de Empresas</SelectItem>
                      <SelectItem value="Derecho">Derecho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      Nombre del Estudiante
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Ej: Juanito Pérez"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                      <School className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      Institución de Origen
                    </label>
                    <input
                      type="text"
                      value={sourceInstitution}
                      onChange={(e) => setSourceInstitution(e.target.value)}
                      placeholder="Ej: Universidad Nacional"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-end pt-4"
          >
            <button
              onClick={handleStartAnalysis}
              disabled={!file || !targetCareer || isAnalyzing}
              className="flex items-center gap-2 bg-blue-800 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-800/20"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analizando Documento...
                </>
              ) : (
                <>
                  Iniciar Estudio Avanzado
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
