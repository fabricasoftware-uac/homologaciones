"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconCalendar as Calendar } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";
import clsx from "clsx";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as Calendario } from "@/components/ui/calendar";
import { PERIODOS } from "@/lib/fechas";

// Fecha local en formato YYYY-MM-DD (sin desfase por zona horaria, a diferencia de toISOString).
function aISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function deISO(s: string | null): Date | undefined {
  return s ? new Date(`${s}T00:00:00`) : undefined;
}

function etiquetaRango(r?: DateRange): string {
  if (!r?.from) return "Personalizado";
  const fmt = (d: Date) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(d);
  return r.to && r.to.getTime() !== r.from.getTime() ? `${fmt(r.from)} – ${fmt(r.to)}` : fmt(r.from);
}

// Filtro de fechas: chips de periodo rápido + un calendario de RANGO (moderno) para elegir un día o
// un rango. La selección es coherente: el primer clic fija el inicio y el segundo el fin. Escribe
// los parámetros en la URL; el servidor lee y filtra.
export function FiltroFechas() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hayRango = !!(params.get("desde") || params.get("hasta"));
  const activo = hayRango ? "personalizado" : params.get("periodo") ?? "todo";

  const [abierto, setAbierto] = useState(false);
  const [rango, setRango] = useState<DateRange | undefined>(
    hayRango ? { from: deISO(params.get("desde")), to: deISO(params.get("hasta")) } : undefined,
  );

  function navegar(sp: URLSearchParams) {
    sp.delete("page");
    const query = sp.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function elegirPeriodo(clave: string) {
    const sp = new URLSearchParams(params);
    sp.delete("desde");
    sp.delete("hasta");
    sp.set("periodo", clave);
    navegar(sp);
  }

  function aplicarRango() {
    if (!rango?.from) return;
    const sp = new URLSearchParams(params);
    sp.delete("periodo");
    sp.set("desde", aISO(rango.from));
    sp.set("hasta", aISO(rango.to ?? rango.from));
    navegar(sp);
    setAbierto(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => elegirPeriodo(p.clave)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activo === p.clave ? "bg-marca text-marca-fg" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={clsx(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors",
              activo === "personalizado"
                ? "bg-marca text-marca-fg border-transparent"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            <Calendar className="w-4 h-4" />
            {activo === "personalizado" ? etiquetaRango(rango) : "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendario
            mode="range"
            numberOfMonths={1}
            selected={rango}
            onSelect={setRango}
            defaultMonth={rango?.from}
            classNames={{
              day_selected: "bg-marca text-marca-fg hover:bg-marca hover:text-marca-fg focus:bg-marca focus:text-marca-fg",
              day_range_start: "day-range-start bg-marca text-marca-fg",
              day_range_end: "day-range-end bg-marca text-marca-fg",
              day_range_middle: "aria-selected:bg-marca/15 dark:aria-selected:bg-marca/25 aria-selected:text-slate-900 dark:aria-selected:text-slate-100",
              day_today: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
            }}
          />
          <div className="p-3 pt-0 flex gap-2">
            <button
              type="button"
              onClick={() => setRango(undefined)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={aplicarRango}
              disabled={!rango?.from}
              className="flex-1 bg-marca text-marca-fg font-semibold py-2 rounded-lg hover:bg-marca-hover disabled:opacity-50 transition-colors text-sm"
            >
              Aplicar
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
