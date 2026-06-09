import { CheckCircle, Download, FileText, ArrowLeft, Briefcase } from "lucide-react";

interface OutcomeProps {
  student: { name: string; career: string };
  approvedCredits: number;
  totalCredits: number;
  onReset: () => void;
}

export function AnalysisOutcome({ student, approvedCredits, totalCredits, onReset }: OutcomeProps) {
  const percentage = Math.round((approvedCredits / totalCredits) * 100) || 0;
  
  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200 text-center relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Homologación Completada
          </h1>
          <p className="text-slate-500 text-lg mb-8 max-w-lg">
            El análisis para <strong className="text-slate-800 font-semibold">{student.name}</strong> en <strong className="text-slate-800 font-semibold">{student.career}</strong> ha sido guardado exitosamente.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-10">
            {/* Stats Cards */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Créditos Aprobados</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-blue-800">{approvedCredits}</span>
                <span className="text-xl font-bold text-slate-400">/ {totalCredits}</span>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Avance de Carrera</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-green-600">{percentage}%</span>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
            <button className="w-full flex items-center justify-center gap-2 bg-blue-800 hover:bg-blue-900 text-white py-3.5 px-6 rounded-xl font-semibold transition-all shadow-lg shadow-blue-800/20">
              <Download className="w-5 h-5" />
              Descargar Resolución (PDF)
            </button>
            <button className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 hover:border-blue-800 hover:text-blue-800 text-slate-700 py-3.5 px-6 rounded-xl font-semibold transition-all">
              <FileText className="w-5 h-5" />
              Plan de Matrícula
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <button 
          onClick={onReset}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Casos de Estudio
        </button>
      </div>
    </div>
  );
}
