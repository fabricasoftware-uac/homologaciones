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
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// Gráficas interactivas de los reportes (recharts). Client components; los datos llegan ya calculados
// desde el servidor. Los colores de grilla/ejes/tooltip se adaptan al tema (claro/oscuro): en oscuro
// la grilla pasa de casi-blanca a slate-800 y el tooltip a una tarjeta oscura.

// Paleta de la gráfica según el tema activo. El guard `montado` evita usar el tema antes de hidratar.
function useColoresGrafica() {
  const { resolvedTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const oscuro = montado && resolvedTheme === "dark";
  return {
    montado,
    oscuro,
    grilla: oscuro ? "#1e293b" : "#f1f5f9",
    eje: oscuro ? "#94a3b8" : "#64748b",
    ejeTenue: oscuro ? "#64748b" : "#94a3b8",
    cursor: oscuro ? "rgba(148,163,184,0.12)" : "#f8fafc",
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

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">{texto}</p>;
}

// Dona de casos por estado, con el total en el centro y una leyenda al lado.
export function GraficaEstados({
  datos,
}: {
  datos: { nombre: string; valor: number; color: string }[];
}) {
  const c = useColoresGrafica();
  // recharts mide el ancho en el cliente: lo renderizamos solo tras montar para no chocar con la
  // hidratación del HTML del servidor (mostramos un skeleton mientras tanto).
  if (!c.montado) return <div className="h-[180px] rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />;
  const total = datos.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <Vacio texto="Sin casos en este periodo." />;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-[180px] h-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="valor"
              nameKey="nombre"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={datos.filter((d) => d.valor > 0).length > 1 ? 2 : 0}
              stroke="none"
            >
              {datos.map((d) => (
                <Cell key={d.nombre} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={c.tooltip} itemStyle={{ color: c.tooltip.color }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{total}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">casos</span>
        </div>
      </div>

      <ul className="flex-1 w-full space-y-2">
        {datos.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-slate-600 dark:text-slate-300 flex-1">{d.nombre}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{d.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras horizontales genéricas (carreras, instituciones, etc.) en el color de marca.
export function GraficaBarras({
  datos,
  color,
}: {
  datos: { nombre: string; cantidad: number }[];
  color: string;
}) {
  const c = useColoresGrafica();
  if (!c.montado) return <div className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />;
  if (datos.length === 0) return <Vacio texto="Sin datos en este periodo." />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, datos.length * 44)}>
      <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={c.grilla} />
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="nombre"
          width={150}
          interval={0}
          tick={{ fontSize: 12, fill: c.eje }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
        />
        <Tooltip contentStyle={c.tooltip} itemStyle={{ color: c.tooltip.color }} cursor={{ fill: c.cursor }} />
        <Bar dataKey="cantidad" fill={color} radius={[0, 6, 6, 0]} barSize={18} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Área de homologaciones en el tiempo (por día del periodo): muestra la tendencia.
export function GraficaTiempo({
  datos,
  color,
}: {
  datos: { fecha: string; cantidad: number }[];
  color: string;
}) {
  const c = useColoresGrafica();
  if (!c.montado) return <div className="h-[210px] rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />;
  if (datos.length === 0) return <Vacio texto="Sin datos en este periodo." />;

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={datos} margin={{ top: 5, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grilla} />
        <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: c.ejeTenue }} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: c.ejeTenue }} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={c.tooltip} itemStyle={{ color: c.tooltip.color }} />
        <Area type="monotone" dataKey="cantidad" stroke={color} strokeWidth={2} fill="url(#areaFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
