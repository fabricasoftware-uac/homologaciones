import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, ChevronRight, Layers, LayoutGrid, Plus, Save, X, Edit3, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";

interface ExtractedSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
}

export function PensumManager() {
  const [view, setView] = useState<"list" | "upload" | "review">("list");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedSubject[]>([]);

  // Mock Active Plans
  const [activePlans, setActivePlans] = useState([
    { id: 1, career: "Contaduría Pública", version: "2024-1", status: "Activo", subjects: 45 },
    { id: 2, career: "Ingeniería de Sistemas", version: "2023-2", status: "Activo", subjects: 50 },
    { id: 3, career: "Administración de Empresas", version: "2022-1", status: "Inactivo", subjects: 42 },
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSimulateExtraction = () => {
    setView("review");
    // Generate mock extracted data (Semesters 1 to 4)
    const mockExtracted: ExtractedSubject[] = [];
    for (let sem = 1; sem <= 4; sem++) {
      for (let i = 1; i <= 5; i++) {
        mockExtracted.push({
          id: `ext-${sem}-${i}`,
          semester: sem,
          code: `MAT${sem}0${i}`,
          name: `Asignatura Generada ${sem}.${i}`,
          credits: Math.floor(Math.random() * 3) + 2
        });
      }
    }
    setExtractedData(mockExtracted);
  };

  const handleSavePlan = () => {
    setActivePlans([
      { id: Date.now(), career: "Nuevo Plan Académico", version: "2026-1", status: "Activo", subjects: extractedData.length },
      ...activePlans
    ]);
    setView("list");
    setFile(null);
  };

  const groupedExtractedData = extractedData.reduce((acc, curr) => {
    if (!acc[curr.semester]) acc[curr.semester] = [];
    acc[curr.semester].push(curr);
    return acc;
  }, {} as Record<number, ExtractedSubject[]>);

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-800" />
              Gestor de Pensum
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Administra los planes académicos y extrae nuevos desde PDF.
            </p>
          </div>
          
          <AnimatePresence mode="popLayout">
            {view === "list" && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setView("upload")}
                className="flex items-center gap-2 bg-blue-800 text-white hover:bg-blue-900 font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Subir Nuevo Pensum
              </motion.button>
            )}
            
            {view === "review" && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3"
              >
                <button 
                  onClick={() => setView("upload")}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSavePlan}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors shadow-green-600/20"
                >
                  <Save className="w-4 h-4" />
                  Guardar como Plan Activo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          
          <AnimatePresence mode="wait">
            {view === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">Planes Académicos Activos</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Carrera</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Versión</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Asignaturas</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {activePlans.map((plan) => (
                          <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{plan.career}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600">{plan.version}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={clsx(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                                plan.status === "Activo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                              )}>
                                {plan.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">{plan.subjects} CR</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl mx-auto mt-10"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cargar Nuevo Plan (Pensum)</h2>
                  <p className="text-slate-500 mt-2 text-lg">Sube el documento PDF oficial de la universidad para extraer la malla curricular mediante IA.</p>
                </div>

                <div
                  className={clsx(
                    "rounded-3xl border-2 border-dashed p-12 flex flex-col items-center justify-center transition-all duration-300 min-h-[400px] bg-white shadow-sm",
                    isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.02]" : file ? "border-green-400 bg-green-50/30" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="text-center flex flex-col items-center">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 shadow-sm border border-green-200">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <p className="font-bold text-slate-800 text-xl">{file.name}</p>
                      <p className="text-slate-500 font-medium mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document</p>
                      
                      <div className="mt-8 flex items-center gap-4">
                        <button
                          type="button"
                          className="px-5 py-2.5 text-sm font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
                          onClick={() => setFile(null)}
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={handleSimulateExtraction}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-xl transition-all shadow-lg shadow-blue-800/20 flex items-center gap-2"
                        >
                          Extraer con IA <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center flex flex-col items-center">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-600 shadow-inner">
                        <UploadCloud className="w-10 h-10" />
                      </div>
                      <p className="font-bold text-slate-800 text-xl mb-3">Arrastra y suelta el PDF aquí</p>
                      <p className="text-slate-500 font-medium mb-8">
                        o{" "}
                        <label className="text-blue-600 font-bold cursor-pointer hover:underline underline-offset-4">
                          explora tus archivos
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]);
                            }}
                          />
                        </label>
                      </p>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 bg-slate-100 px-4 py-2 rounded-full">
                        <FileText className="w-4 h-4" /> Max 20MB
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-blue-600" />
                      Revisión de Extracción (Grid de Semestres)
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Verifica la información extraída antes de guardarla.</p>
                  </div>
                  <div className="text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                    {extractedData.length} Asignaturas detectadas
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                  {Object.entries(groupedExtractedData).map(([sem, subjects]) => (
                    <div key={sem} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                      <div className="bg-blue-50/50 border-b border-slate-100 px-5 py-4">
                        <h3 className="font-black text-blue-900 tracking-wide uppercase text-sm">Semestre {sem}</h3>
                      </div>
                      
                      <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px]">
                        {subjects.map((sub) => (
                          <div key={sub.id} className="relative group bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-md transition-all">
                            <button className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 hover:bg-red-50 rounded-md">
                              <X className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="text-xs font-bold text-slate-400 mb-1 tracking-wider">{sub.code}</div>
                            <div className="font-bold text-slate-800 text-sm leading-tight mb-2 pr-6">{sub.name}</div>
                            
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {sub.credits} CR
                              </span>
                            </div>
                          </div>
                        ))}
                        
                        <button className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                          <Plus className="w-4 h-4" /> Agregar Asignatura
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
      </main>
    </div>
  );
}
