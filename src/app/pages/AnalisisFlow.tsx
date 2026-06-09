import { useState } from "react";
import { AnalysisSetup } from "../components/AnalysisSetup";
import { AnalysisDashboard } from "../components/AnalysisDashboard";
import { AnalysisOutcome } from "../components/AnalysisOutcome";
import { motion, AnimatePresence } from "motion/react";

export type FlowStep = "setup" | "analyzing" | "dashboard" | "outcome";

export interface StudentData {
  name: string;
  career: string;
  sourceUniversity: string;
}

export function AnalisisFlow() {
  const [step, setStep] = useState<FlowStep>("setup");
  const [student, setStudent] = useState<StudentData | null>(null);
  
  // Total credits and approved credits handled in state
  const [totalCredits, setTotalCredits] = useState(120);
  const [approvedCredits, setApprovedCredits] = useState(0);

  const startAnalysis = (data: StudentData) => {
    setStudent(data);
    setStep("analyzing");
    // Simulate AI Processing
    setTimeout(() => {
      setStep("dashboard");
    }, 2500);
  };

  const finishAnalysis = (approved: number) => {
    setApprovedCredits(approved);
    setStep("outcome");
  };

  const resetFlow = () => {
    setStudent(null);
    setApprovedCredits(0);
    setStep("setup");
  };

  return (
    <div className="h-full bg-slate-50 relative overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 overflow-auto p-8"
          >
            <AnalysisSetup onStart={startAnalysis} />
          </motion.div>
        )}

        {step === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Procesando con IA...</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Analizando el certificado de notas, extrayendo asignaturas y comparando con el pensum de {student?.career}...
            </p>
          </motion.div>
        )}

        {step === "dashboard" && student && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 overflow-auto flex flex-col"
          >
            <AnalysisDashboard 
              student={student} 
              onComplete={finishAnalysis} 
            />
          </motion.div>
        )}

        {step === "outcome" && student && (
          <motion.div
            key="outcome"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 overflow-auto p-8"
          >
            <AnalysisOutcome 
              student={student}
              approvedCredits={approvedCredits}
              totalCredits={totalCredits}
              onReset={resetFlow}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
