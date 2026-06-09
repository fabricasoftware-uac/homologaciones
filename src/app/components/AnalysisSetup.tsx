import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2 } from "lucide-react";

interface SetupProps {
  onStart: (data: { name: string; career: string; sourceUniversity: string }) => void;
}

export function AnalysisSetup({ onStart }: SetupProps) {
  const [file, setFile] = useState<File | null>(null);
  const [career, setCareer] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && career) {
      onStart({
        name: "Juanito Pérez",
        career,
        sourceUniversity: "Universidad Origen",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Homologación</h1>
        <p className="text-slate-500 mt-2 text-lg">
          Sube el certificado de notas del estudiante y selecciona la carrera de destino.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Dropzone */}
        <div
          className={`col-span-1 rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center transition-all duration-200 ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : file
              ? "border-green-500 bg-green-50"
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {file ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="font-semibold text-slate-800 text-lg">{file.name}</p>
              <p className="text-slate-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                className="mt-6 text-sm text-red-600 font-medium hover:underline"
                onClick={() => setFile(null)}
              >
                Eliminar y subir otro
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600">
                <UploadCloud className="w-8 h-8" />
              </div>
              <p className="font-semibold text-slate-800 text-lg mb-2">Sube el certificado (PDF)</p>
              <p className="text-slate-500 text-center mb-6 text-sm">
                Arrastra y suelta aquí, o{" "}
                <label className="text-blue-600 font-medium cursor-pointer hover:underline">
                  explora archivos
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </p>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <FileText className="w-4 h-4" />
                <span>Max 10MB</span>
              </div>
            </>
          )}
        </div>

        {/* Configuration Panel */}
        <div className="col-span-1 flex flex-col justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Configuración de Destino</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Carrera de Destino
                </label>
                <select
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="" disabled>Selecciona una carrera</option>
                  <option value="Contaduría Pública">Contaduría Pública</option>
                  <option value="Ingeniería de Sistemas">Ingeniería de Sistemas</option>
                  <option value="Administración de Empresas">Administración de Empresas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Plan Académico (Pensum)
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={!career}
                >
                  <option>Plan 2024-1 (Vigente)</option>
                  <option>Plan 2020-2</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!file || !career}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all shadow-sm ${
                  file && career
                    ? "bg-blue-800 hover:bg-blue-900 cursor-pointer shadow-blue-800/20 shadow-lg"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                Analizar Homologación
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
