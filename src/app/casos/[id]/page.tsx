"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, Link as LinkIcon, Check, X, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  intensity: number;
  grade?: number;
  semester: number;
}

interface Link {
  id: string;
  sourceIds: string[];
  targetIds: string[];
  confidence: number;
  status: "pending" | "approved" | "rejected";
}

const sourceSubjects: Subject[] = [
  { id: "s1", name: "Fundamentos de Contabilidad", code: "FC101", credits: 4, intensity: 64, grade: 4.5, semester: 1 },
  { id: "s2", name: "Álgebra Lineal", code: "AL101", credits: 3, intensity: 48, grade: 3.8, semester: 1 },
  { id: "s3", name: "Introducción al Derecho", code: "ID101", credits: 2, intensity: 32, grade: 4.0, semester: 1 },
  { id: "s4", name: "Contabilidad Financiera", code: "CF102", credits: 4, intensity: 64, grade: 4.2, semester: 2 },
  { id: "s5", name: "Cálculo Diferencial", code: "CD102", credits: 3, intensity: 48, grade: 3.5, semester: 2 },
  { id: "s6", name: "Microeconomía", code: "ME102", credits: 3, intensity: 48, grade: 4.1, semester: 2 },
  { id: "s7", name: "Derecho Comercial I", code: "DC201", credits: 2, intensity: 32, grade: 3.9, semester: 3 },
  { id: "s8", name: "Derecho Comercial II", code: "DC202", credits: 2, intensity: 32, grade: 4.2, semester: 3 },
];

const targetSubjects: Subject[] = [
  { id: "t1", name: "Contabilidad Básica", code: "CON101", credits: 4, intensity: 64, semester: 1 },
  { id: "t2", name: "Matemáticas I", code: "MAT101", credits: 3, intensity: 48, semester: 1 },
  { id: "t3", name: "Competencias Comunicativas", code: "HUM101", credits: 2, intensity: 32, semester: 1 },
  { id: "t4", name: "Contabilidad Intermedia", code: "CON102", credits: 4, intensity: 64, semester: 2 },
  { id: "t5", name: "Matemáticas II", code: "MAT102", credits: 3, intensity: 48, semester: 2 },
  { id: "t6", name: "Economía General", code: "ECO101", credits: 3, intensity: 48, semester: 2 },
  { id: "t7", name: "Contabilidad Avanzada", code: "CON201", credits: 4, intensity: 64, semester: 3 },
  { id: "t8", name: "Legislación Comercial", code: "DER201", credits: 3, intensity: 48, semester: 3 },
];

const initialLinks: Link[] = [
  { id: "l1", sourceIds: ["s1"], targetIds: ["t1"], confidence: 92, status: "pending" },
  { id: "l2", sourceIds: ["s2"], targetIds: ["t2"], confidence: 75, status: "pending" },
  { id: "l3", sourceIds: ["s4"], targetIds: ["t4"], confidence: 85, status: "pending" },
  { id: "l4", sourceIds: ["s5"], targetIds: ["t5"], confidence: 80, status: "pending" },
  { id: "l5", sourceIds: ["s6"], targetIds: ["t6"], confidence: 65, status: "pending" },
  { id: "l6", sourceIds: ["s7", "s8"], targetIds: ["t8"], confidence: 88, status: "pending" },
];

export default function StudioPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());

  const sourceSemesters = useMemo(() => {
    const sem = new Set(sourceSubjects.map(s => s.semester));
    return Array.from(sem).sort((a, b) => a - b);
  }, []);

  const targetSemesters = useMemo(() => {
    const sem = new Set(targetSubjects.map(s => s.semester));
    return Array.from(sem).sort((a, b) => a - b);
  }, []);

  const [expandedSourceSems, setExpandedSourceSems] = useState<Set<number>>(new Set(sourceSemesters));
  const [expandedTargetSems, setExpandedTargetSems] = useState<Set<number>>(new Set(targetSemesters));

  const handleSourceSelect = (subjectId: string) => {
    const newSet = new Set(selectedSourceIds);
    if (newSet.has(subjectId)) newSet.delete(subjectId);
    else newSet.add(subjectId);
    setSelectedSourceIds(newSet);
  };

  const handleTargetSelect = (subjectId: string) => {
    const newSet = new Set(selectedTargetIds);
    if (newSet.has(subjectId)) newSet.delete(subjectId);
    else newSet.add(subjectId);
    setSelectedTargetIds(newSet);
  };

  const handleCreateLink = () => {
    if (selectedSourceIds.size === 0 || selectedTargetIds.size === 0) return;
    const newLink: Link = {
      id: `l${Date.now()}`,
      sourceIds: Array.from(selectedSourceIds),
      targetIds: Array.from(selectedTargetIds),
      confidence: 100,
      status: "approved"
    };

    const filteredLinks = links.filter(l =>
      !l.sourceIds.some(sid => selectedSourceIds.has(sid)) &&
      !l.targetIds.some(tid => selectedTargetIds.has(tid))
    );

    setLinks([...filteredLinks, newLink]);
    setSelectedSourceIds(new Set());
    setSelectedTargetIds(new Set());
  };

  const getActiveLinkForSubject = (subjectId: string, type: "source" | "target") => {
    return links.find(l =>
      type === "source" ? l.sourceIds.includes(subjectId) : l.targetIds.includes(subjectId)
    );
  };

  const toggleSourceSem = (sem: number) => {
    const next = new Set(expandedSourceSems);
    if (next.has(sem)) next.delete(sem); else next.add(sem);
    setExpandedSourceSems(next);
  };

  const toggleTargetSem = (sem: number) => {
    const next = new Set(expandedTargetSems);
    if (next.has(sem)) next.delete(sem); else next.add(sem);
    setExpandedTargetSems(next);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/casos")}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Estudio de Homologación Avanzado</h1>
            <p className="text-sm text-slate-500 font-medium">Juanito Pérez • Contaduría Pública</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold px-4 py-2 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
            {links.filter(l => l.status === "approved").length} Enlaces Aprobados
          </div>
          <button className="bg-blue-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-900 transition-colors shadow-sm shadow-blue-800/20">
            Finalizar Revisión
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">

        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Origen: Universidad Nacional</h2>
            <p className="text-xs text-slate-400 mt-1">Asignaturas extraídas del certificado (PDF)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {sourceSemesters.map(sem => (
              <SemesterGroup
                key={`s-${sem}`}
                title={`Semestre ${sem}`}
                expanded={expandedSourceSems.has(sem)}
                onToggle={() => toggleSourceSem(sem)}
              >
                {sourceSubjects.filter(s => s.semester === sem).map(subject => {
                  const link = getActiveLinkForSubject(subject.id, "source");
                  const isSelected = selectedSourceIds.has(subject.id);
                  const isLinkedToSelectedTarget = link && Array.from(selectedTargetIds).some(tid => link.targetIds.includes(tid));

                  return (
                    <SubjectCard
                      key={subject.id}
                      subject={subject}
                      type="source"
                      link={link}
                      isSelected={isSelected}
                      isHighlighted={!!isLinkedToSelectedTarget}
                      onSelect={() => handleSourceSelect(subject.id)}
                    />
                  );
                })}
              </SemesterGroup>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
          <div className="p-4 border-b border-slate-200 bg-white shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-800">Destino: Contaduría Pública</h2>
            <p className="text-xs text-slate-500 mt-1">Plan Académico Vigente (1 a 10 Semestres)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {targetSemesters.map(sem => (
              <SemesterGroup
                key={`t-${sem}`}
                title={`Semestre ${sem}`}
                expanded={expandedTargetSems.has(sem)}
                onToggle={() => toggleTargetSem(sem)}
              >
                {targetSubjects.filter(s => s.semester === sem).map(subject => {
                  const link = getActiveLinkForSubject(subject.id, "target");
                  const isSelected = selectedTargetIds.has(subject.id);
                  const isLinkedToSelectedSource = link && Array.from(selectedSourceIds).some(sid => link.sourceIds.includes(sid));

                  return (
                    <SubjectCard
                      key={subject.id}
                      subject={subject}
                      type="target"
                      link={link}
                      isSelected={isSelected}
                      isHighlighted={!!isLinkedToSelectedSource}
                      onSelect={() => handleTargetSelect(subject.id)}
                    />
                  );
                })}
              </SemesterGroup>
            ))}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {(selectedSourceIds.size > 0 || selectedTargetIds.size > 0) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6 z-50 border border-slate-700"
          >
            <div className="flex items-center gap-4 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-400">
                  {selectedSourceIds.size}
                </span>
                Origen
              </span>
              <span className="text-slate-500">+</span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400">
                  {selectedTargetIds.size}
                </span>
                Destino
              </span>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <button
              onClick={handleCreateLink}
              disabled={selectedSourceIds.size === 0 || selectedTargetIds.size === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/50"
            >
              <LinkIcon className="w-4 h-4" />
              Vincular (Many-to-Many)
            </button>
            <button
              onClick={() => { setSelectedSourceIds(new Set()); setSelectedTargetIds(new Set()); }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SemesterGroup({ title, expanded, onToggle, children }: { title: string, expanded: boolean, onToggle: () => void, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200/50"
      >
        <span className="font-bold text-slate-800">{title}</span>
        <div className="text-slate-400">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 grid gap-3 bg-slate-50/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubjectCard({
  subject,
  type,
  link,
  isSelected,
  isHighlighted,
  onSelect
}: {
  subject: Subject,
  type: "source" | "target",
  link?: Link,
  isSelected: boolean,
  isHighlighted: boolean,
  onSelect: () => void
}) {

  const getLinkColor = () => {
    if (!link) return "border-slate-200 bg-white hover:border-slate-300";
    if (link.status === "approved") return "border-green-300 bg-green-50/80 shadow-[0_0_10px_rgba(34,197,94,0.15)] ring-1 ring-green-300";
    if (link.status === "rejected") return "border-red-200 bg-red-50/50 opacity-60";
    return "border-amber-200 bg-amber-50/50 ring-1 ring-amber-200 shadow-sm";
  };

  const selectedClass = isSelected
    ? "ring-2 ring-blue-500 border-blue-500 shadow-md transform scale-[1.02]"
    : isHighlighted
      ? "ring-2 ring-indigo-400/50 border-indigo-300 shadow-sm"
      : getLinkColor();

  const getConfidenceBadge = (sim: number) => {
    if (sim >= 80) return "text-green-700 bg-green-100 border-green-200";
    if (sim >= 50) return "text-amber-700 bg-amber-100 border-amber-200";
    return "text-red-700 bg-red-100 border-red-200";
  };

  return (
    <div
      onClick={onSelect}
      className={clsx(
        "relative rounded-xl border p-3 cursor-pointer transition-all duration-200 select-none",
        selectedClass
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded shadow-sm border border-slate-100">
          {subject.code}
        </span>

        {link && link.status === "pending" && type === "target" && (
          <div className={clsx("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", getConfidenceBadge(link.confidence))}>
            {link.confidence >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {link.confidence}% IA
          </div>
        )}

        {link && link.status === "approved" && (
          <div className="text-[10px] font-bold text-green-700 flex items-center gap-1 bg-green-100 px-2 py-0.5 rounded-full">
            <LinkIcon className="w-3 h-3" /> Vinculado
          </div>
        )}
      </div>

      <h3 className={clsx("font-bold leading-snug mb-3", type === "target" ? "text-blue-900" : "text-slate-800")}>
        {subject.name}
      </h3>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center text-xs font-semibold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-md">
          {subject.credits} CR
        </span>
        <span className="inline-flex items-center text-xs font-semibold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-md">
          {subject.intensity} IH
        </span>
        {subject.grade !== undefined && (
          <span className="inline-flex items-center text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm ml-auto">
            Nota: {subject.grade.toFixed(1)}
          </span>
        )}
      </div>

      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm">
          <Check className="w-3 h-3" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
