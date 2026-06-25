"use client";

import { IconLayoutList as Lista, IconChevronDown as ChevronDown } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Selector de plantillas de nota: un menú (no un <select> nativo, cuyas opciones no se pueden
// estilizar y salen blancas en oscuro). Al elegir una, inserta su texto en la nota para el
// estudiante. Usa el DropdownMenu de Radix, que toma los tokens del tema (claro/oscuro).
export function SelectorPlantilla({
  plantillas,
  onInsertar,
}: {
  plantillas: { id: string; texto: string }[];
  onInsertar: (texto: string) => void;
}) {
  if (plantillas.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors text-marca border-marca/30 bg-marca/5 hover:bg-marca/10 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
        >
          <Lista className="w-3.5 h-3.5" />
          Insertar plantilla
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        {plantillas.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => onInsertar(p.texto)}
            className="text-xs leading-relaxed whitespace-normal cursor-pointer"
          >
            {p.texto}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
