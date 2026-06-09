import { useState } from "react";
import { Plus, Search, FileDown, BookOpen, Layers, Info } from "lucide-react";

export function PensumManagement() {
  const [activeTab, setActiveTab] = useState("Contaduría Pública");
  
  const careers = ["Contaduría Pública", "Ingeniería de Sistemas", "Administración de Empresas"];
  
  const subjects = [
    { sem: 1, code: "CON101", name: "Contabilidad Básica", credits: 4, req: "-" },
    { sem: 1, code: "MAT101", name: "Matemáticas I", credits: 3, req: "-" },
    { sem: 1, code: "HUM101", name: "Competencias Comunicativas", credits: 2, req: "-" },
    { sem: 2, code: "CON102", name: "Contabilidad Intermedia", credits: 4, req: "CON101" },
    { sem: 2, code: "MAT102", name: "Matemáticas II", credits: 3, req: "MAT101" },
    { sem: 2, code: "ECO101", name: "Economía General", credits: 3, req: "-" },
    { sem: 3, code: "CON201", name: "Contabilidad Avanzada", credits: 4, req: "CON102" },
    { sem: 3, code: "DER201", name: "Legislación Comercial", credits: 3, req: "-" },
  ];

  return (
    <div className="h-full bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 p-6 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-800" />
              Gestión de Planes Académicos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Administra los pensum vigentes por carrera para el análisis de homologaciones.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
              <FileDown className="w-4 h-4" />
              Exportar
            </button>
            <button className="flex items-center gap-2 bg-blue-800 text-white hover:bg-blue-900 font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
              <Plus className="w-4 h-4" />
              Nuevo Pensum
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="border-b border-slate-200 flex overflow-x-auto scrollbar-hide">
              {careers.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveTab(c)}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors
                    ${activeTab === c 
                      ? 'border-blue-800 text-blue-800 bg-blue-50/30' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                  `}
                >
                  {c}
                </button>
              ))}
            </div>
            
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full md:w-96">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Buscar asignatura por nombre o código..."
                  />
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-md font-medium">
                  <Info className="w-4 h-4" />
                  Plan Vigente: 2024-1
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Semestre
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Código
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Nombre de la Asignatura
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Créditos
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Prerrequisitos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {subjects.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 w-8 h-8 rounded-full text-sm font-bold">
                            {s.sem}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                          {s.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {s.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                            {s.credits} CR
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                          {s.req !== "-" ? (
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600 font-semibold">{s.req}</span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
