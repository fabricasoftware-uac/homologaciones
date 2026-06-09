import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Check, X, CheckCircle2, AlertTriangle, AlertCircle, FileCheck, ArrowRight } from "lucide-react";

interface DashboardProps {
  student: { name: string; career: string };
  onComplete: (approvedCredits: number) => void;
}

type Status = "pending" | "approved" | "rejected";

interface SubjectMatch {
  id: string;
  targetName: string;
  targetCode: string;
  targetCredits: number;
  sourceName: string;
  sourceCredits: number;
  similarity: number;
  status: Status;
}

interface SemesterData {
  id: number;
  name: string;
  subjects: SubjectMatch[];
}

const initialData: SemesterData[] = [
  {
    id: 1,
    name: "Semestre 1",
    subjects: [
      { id: "s1-1", targetName: "Contabilidad Básica", targetCode: "CON101", targetCredits: 4, sourceName: "Fundamentos de Contabilidad", sourceCredits: 4, similarity: 92, status: "pending" },
      { id: "s1-2", targetName: "Matemáticas I", targetCode: "MAT101", targetCredits: 3, sourceName: "Álgebra Lineal", sourceCredits: 3, similarity: 75, status: "pending" },
      { id: "s1-3", targetName: "Competencias Comunicativas", targetCode: "HUM101", targetCredits: 2, sourceName: "Ninguna", sourceCredits: 0, similarity: 10, status: "pending" },
    ],
  },
  {
    id: 2,
    name: "Semestre 2",
    subjects: [
      { id: "s2-1", targetName: "Contabilidad Intermedia", targetCode: "CON102", targetCredits: 4, sourceName: "Contabilidad Financiera", sourceCredits: 4, similarity: 85, status: "pending" },
      { id: "s2-2", targetName: "Matemáticas II", targetCode: "MAT102", targetCredits: 3, sourceName: "Cálculo Diferencial", sourceCredits: 3, similarity: 80, status: "pending" },
      { id: "s2-3", targetName: "Economía General", targetCode: "ECO101", targetCredits: 3, sourceName: "Microeconomía", sourceCredits: 3, similarity: 65, status: "pending" },
    ],
  },
  {
    id: 3,
    name: "Semestre 3",
    subjects: [
      { id: "s3-1", targetName: "Contabilidad Avanzada", targetCode: "CON201", targetCredits: 4, sourceName: "Ninguna", sourceCredits: 0, similarity: 0, status: "pending" },
      { id: "s3-2", targetName: "Legislación Comercial", targetCode: "DER201", targetCredits: 3, sourceName: "Derecho Comercial I", sourceCredits: 2, similarity: 88, status: "pending" },
    ],
  }
];

export function AnalysisDashboard({ student, onComplete }: DashboardProps) {
  const [data, setData] = useState<SemesterData[]>(initialData);
  const [expandedSemesters, setExpandedSemesters] = useState<number[]>([1, 2]);

  const toggleSemester = (id: number) => {
    setExpandedSemesters(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleStatusChange = (semesterId: number, subjectId: string, status: Status) => {
    setData(prev => prev.map(sem => {
      if (sem.id === semesterId) {
        return {
          ...sem,
          subjects: sem.subjects.map(sub => 
            sub.id === subjectId ? { ...sub, status } : sub
          )
        };
      }
      return sem;
    }));
  };

  const allSubjects = data.flatMap(sem => sem.subjects);
  const totalCredits = allSubjects.reduce((sum, sub) => sum + sub.targetCredits, 0);
  const approvedCredits = allSubjects
    .filter(sub => sub.status === "approved")
    .reduce((sum, sub) => sum + sub.targetCredits, 0);
  const progressPercent = Math.round((approvedCredits / totalCredits) * 100) || 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 p-6 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{student.name}</h1>
              <p className="text-sm font-medium text-slate-500">
                Destino: <span className="text-blue-800 font-semibold">{student.career}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-500 mb-1">Total Créditos Aprobados</div>
                <div className="text-2xl font-bold text-blue-800">
                  {approvedCredits} <span className="text-base font-normal text-slate-400">/ {totalCredits}</span>
                </div>
              </div>
              <button 
                onClick={() => onComplete(approvedCredits)}
                className="bg-blue-800 hover:bg-blue-900 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                <FileCheck className="w-5 h-5" />
                Finalizar
              </button>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-3 mb-1 overflow-hidden">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-slate-500 text-right">{progressPercent}% Homologado</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {data.map(semester => (
            <SemesterGroup 
              key={semester.id} 
              semester={semester} 
              isExpanded={expandedSemesters.includes(semester.id)}
              onToggle={() => toggleSemester(semester.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function SemesterGroup({ 
  semester, 
  isExpanded, 
  onToggle, 
  onStatusChange 
}: { 
  semester: SemesterData, 
  isExpanded: boolean, 
  onToggle: () => void,
  onStatusChange: (semId: number, subId: string, status: Status) => void 
}) {
  const approvedCount = semester.subjects.filter(s => s.status === 'approved').length;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800">{semester.name}</h2>
          <span className="text-xs font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 shadow-sm">
            {semester.subjects.length} Asignaturas
          </span>
          {approvedCount > 0 && (
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {approvedCount} Aprobadas
            </span>
          )}
        </div>
        <div className="text-slate-400">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 flex flex-col gap-4 bg-white">
              {semester.subjects.map(subject => (
                <SubjectCard 
                  key={subject.id} 
                  subject={subject} 
                  onStatusChange={(status) => onStatusChange(semester.id, subject.id, status)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubjectCard({ 
  subject, 
  onStatusChange 
}: { 
  subject: SubjectMatch, 
  onStatusChange: (status: Status) => void 
}) {
  const isApproved = subject.status === "approved";
  const isRejected = subject.status === "rejected";

  const getSimilarityColor = (sim: number) => {
    if (sim >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (sim >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getSimilarityIcon = (sim: number) => {
    if (sim >= 80) return <CheckCircle2 className="w-4 h-4" />;
    if (sim >= 50) return <AlertTriangle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className={`
      relative overflow-hidden rounded-xl border p-4 transition-all duration-300
      ${isApproved ? 'border-green-300 bg-green-50/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : ''}
      ${isRejected ? 'border-red-200 bg-red-50/30' : ''}
      ${!isApproved && !isRejected ? 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md' : ''}
    `}>
      <div className="flex flex-col md:flex-row gap-6 items-center">
        
        {/* Destino (Target) */}
        <div className="flex-1 w-full border-l-4 border-blue-800 pl-4 py-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Materia Destino</div>
          <div className="font-bold text-slate-800 text-lg">{subject.targetName}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {subject.targetCode}
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              {subject.targetCredits} CR
            </span>
          </div>
        </div>

        {/* Separator / Arrow */}
        <div className="hidden md:flex flex-col items-center justify-center text-slate-300 px-2">
          <ArrowRight className="w-5 h-5 mb-1" />
        </div>

        {/* Origen (Source) */}
        <div className="flex-1 w-full border-l-4 border-slate-300 pl-4 py-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Materia Origen</div>
          {subject.sourceName !== "Ninguna" ? (
            <>
              <div className="font-bold text-slate-700 text-lg truncate" title={subject.sourceName}>
                {subject.sourceName}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {subject.sourceCredits} CR
                </span>
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getSimilarityColor(subject.similarity)}`}>
                  {getSimilarityIcon(subject.similarity)}
                  {subject.similarity}% Similitud
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center h-full text-sm font-medium text-slate-400 italic mt-2">
              No se encontró coincidencia
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0 justify-end md:justify-center border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 mt-2 md:mt-0">
          <button 
            onClick={() => onStatusChange("approved")}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all shadow-sm
              ${isApproved 
                ? 'bg-green-500 text-white shadow-green-500/20 shadow-lg scale-105' 
                : 'bg-white border border-slate-200 text-slate-400 hover:text-green-600 hover:border-green-300 hover:bg-green-50'
              }
            `}
            title="Aprobar Homologación"
          >
            <Check className={`w-6 h-6 ${isApproved ? 'stroke-[3]' : ''}`} />
          </button>
          
          <button 
            onClick={() => onStatusChange("rejected")}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all shadow-sm
              ${isRejected 
                ? 'bg-red-500 text-white shadow-red-500/20 shadow-lg scale-105' 
                : 'bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'
              }
            `}
            title="Desaprobar"
          >
            <X className={`w-6 h-6 ${isRejected ? 'stroke-[3]' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
