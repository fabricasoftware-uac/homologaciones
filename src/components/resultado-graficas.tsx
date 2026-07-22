"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { DatosGraficas } from "@/lib/graficas/computar-datos";

const MARCA_CLARO = "#2563eb";
const MARCA_OSCURO = "#60a5fa";
const RESTO_CLARO = "#e2e8f0";
const RESTO_OSCURO = "#334155";
const GRILLA_CLARO = "#f1f5f9";
const GRILLA_OSCURO = "#1e293b";
const EJE_CLARO = "#64748b";
const EJE_OSCURO = "#94a3b8";

function useColoresGrafica() {
  const { resolvedTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const oscuro = montado && resolvedTheme === "dark";

  return {
    montado,
    oscuro,
    brand: oscuro ? MARCA_OSCURO : MARCA_CLARO,
    resto: oscuro ? RESTO_OSCURO : RESTO_CLARO,
    grilla: oscuro ? GRILLA_OSCURO : GRILLA_CLARO,
    eje: oscuro ? EJE_OSCURO : EJE_CLARO,
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${oscuro ? "#1e293b" : "#e2e8f0"}`,
      background: oscuro ? "#0f172a" : "#ffffff",
      color: oscuro ? "#f1f5f9" : "#0f172a",
      boxShadow: "0 8px 24px rgba(2,6,23,0.32)",
      fontSize: 13,
      padding: "8px 12px",
    } as const,
  };
}

function GraficaProgreso({
  creditosHomologados,
  creditosTotales,
  colores,
}: {
  creditosHomologados: number;
  creditosTotales: number;
  colores: ReturnType<typeof useColoresGrafica>;
}) {
  if (!colores.montado)
    return (
      <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
    );

  const pct = Math.round((creditosHomologados / creditosTotales) * 100);
  const resto = Math.max(0, creditosTotales - creditosHomologados);

  const data = [
    { name: "Homologados", value: creditosHomologados },
    { name: "Restantes", value: resto },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Progreso de creditos
      </h3>
      <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
            >
              <Cell fill={colores.brand} />
              <Cell fill={colores.resto} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {pct}%
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-tight">
            {creditosHomologados} de {creditosTotales} cr
          </span>
        </div>
      </div>
    </div>
  );
}

function GraficaDistribucion({
  porSemestre,
  colores,
}: {
  porSemestre: DatosGraficas["porSemestre"];
  colores: ReturnType<typeof useColoresGrafica>;
}) {
  if (!colores.montado)
    return (
      <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
    );

  if (porSemestre.length === 0) return null;

  const data = porSemestre.map((s) => ({
    name: `${s.semestre}.\u00BA sem`,
    homologados: s.creditosHomologados,
    restantes: Math.max(0, s.creditosTotales - s.creditosHomologados),
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Creditos por semestre
      </h3>
      <ResponsiveContainer
        width="100%"
        height={Math.max(120, data.length * 40)}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            interval={0}
            tick={{ fontSize: 12, fill: colores.eje }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={colores.tooltip}
            itemStyle={{ color: colores.tooltip.color }}
          />
          <Bar
            dataKey="homologados"
            stackId="a"
            fill={colores.brand}
            radius={[0, 0, 0, 0]}
            barSize={18}
          />
          <Bar
            dataKey="restantes"
            stackId="a"
            fill={colores.resto}
            radius={[0, 6, 6, 0]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResumenCreditos({
  creditosHomologados,
  creditosTotales,
  colores,
}: {
  creditosHomologados: number;
  creditosTotales: number;
  colores: ReturnType<typeof useColoresGrafica>;
}) {
  if (!colores.montado)
    return (
      <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
    );

  const pct = Math.round((creditosHomologados / creditosTotales) * 100);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {creditosHomologados}
        </span>
        <span className="text-sm text-slate-400 dark:text-slate-500">
          de {creditosTotales} creditos totales
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: colores.brand }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {pct}% de la carrera cubierto
      </p>
    </div>
  );
}

export function ResultadoGraficas({ datos }: { datos: DatosGraficas }) {
  const colores = useColoresGrafica();

  if (datos.creditosTotales === 0) return null;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-7">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GraficaProgreso
          creditosHomologados={datos.creditosHomologados}
          creditosTotales={datos.creditosTotales}
          colores={colores}
        />
        <div className="md:col-span-2 space-y-6">
          <ResumenCreditos
            creditosHomologados={datos.creditosHomologados}
            creditosTotales={datos.creditosTotales}
            colores={colores}
          />
          <GraficaDistribucion
            porSemestre={datos.porSemestre}
            colores={colores}
          />
        </div>
      </div>
    </section>
  );
}
