"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Clock, CheckCircle2, AlertCircle, TrendingUp, Users } from "lucide-react";

interface Case {
  id: string;
  studentName: string;
  sourceInstitution: string;
  targetCareer: string;
  date: string;
  status: "Analizando" | "Listo para Revisión" | "Completado";
  confidence: number;
}

const mockCases: Case[] = [
  { id: "1", studentName: "Juanito Pérez", sourceInstitution: "Universidad Nacional", targetCareer: "Contaduría Pública", date: "12 Abr 2026", status: "Listo para Revisión", confidence: 85 },
  { id: "2", studentName: "María Gómez", sourceInstitution: "Politécnico Grancolombiano", targetCareer: "Ingeniería de Sistemas", date: "10 Abr 2026", status: "Completado", confidence: 92 },
  { id: "3", studentName: "Carlos López", sourceInstitution: "Universidad de Antioquia", targetCareer: "Administración de Empresas", date: "13 Abr 2026", status: "Analizando", confidence: 0 },
  { id: "4", studentName: "Ana Martínez", sourceInstitution: "SENA", targetCareer: "Contaduría Pública", date: "08 Abr 2026", status: "Listo para Revisión", confidence: 60 },
  { id: "5", studentName: "Luis Rodríguez", sourceInstitution: "Universidad del Valle", targetCareer: "Ingeniería de Sistemas", date: "05 Abr 2026", status: "Completado", confidence: 78 },
];

export default function CasosPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const pendingCount = mockCases.filter(c => c.status === "Listo para Revisión").length;
  const avgConfidence = Math.round(
    mockCases.filter(c => c.confidence > 0).reduce((acc, curr) => acc + curr.confidence, 0) /
    mockCases.filter(c => c.confidence > 0).length
  );

  const filteredCases = mockCases.filter(c =>
    c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sourceInstitution.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.targetCareer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Case["status"]) => {
    switch (status) {
      case "Analizando":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"><Clock className="w-3.5 h-3.5" /> Analizando</span>;
      case "Listo para Revisión":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><AlertCircle className="w-3.5 h-3.5" /> Listo para Revisión</span>;
      case "Completado":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="w-3.5 h-3.5" /> Completado</span>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bandeja de Casos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestiona y revisa las homologaciones pendientes (Profesor Iván).
            </p>
          </div>
          <button
            className="flex items-center gap-2 bg-blue-800 text-white hover:bg-blue-900 font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
            onClick={() => router.push("/casos/nuevo")}
          >
            <Plus className="w-4 h-4" />
            Nuevo Caso
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Evaluaciones Pendientes</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{pendingCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
              <div className="p-3 bg-green-100 text-green-700 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Confianza Promedio (IA)</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{avgConfidence}%</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Casos Totales</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{mockCases.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
              <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                  placeholder="Buscar estudiante, institución o carrera..."
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                <Filter className="w-4 h-4" />
                Filtros
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estudiante</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Institución Origen</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Carrera Destino</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredCases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/casos/${c.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs mr-3">
                            {c.studentName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="text-sm font-bold text-slate-900">{c.studentName}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{c.sourceInstitution}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{c.targetCareer}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{c.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className="text-blue-600 group-hover:text-blue-800 transition-colors">
                          {c.status === "Completado" ? "Ver Detalles" : "Revisar Estudio"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCases.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No se encontraron casos que coincidan con la búsqueda.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
