"use client";

import { useState } from "react";
import { IconCheck as Check, IconSelector as ChevronsUpDown } from "@tabler/icons-react";
import clsx from "clsx";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// Selector de la carrera de destino con BUSCADOR (mismo diseño que el de institución de origen). Un
// <select> nativo dibuja su lista en blanco y no se puede estilizar para el modo oscuro; este usa
// Popover + Command (cmdk), que toman los colores del tema. Guarda el ID del pensum en un input
// oculto con el `name` que espera la server action.
type Opcion = { id: string; carrera: string };

export function SelectorCarrera({ pensums, name }: { pensums: Opcion[]; name: string }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(""); // id del pensum elegido
  const seleccionada = pensums.find((p) => p.id === valor);

  return (
    <>
      <input type="hidden" name={name} value={valor} />

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-left"
          >
            <span
              className={clsx(
                "truncate",
                seleccionada ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500",
              )}
            >
              {seleccionada?.carrera || "Selecciona un programa académico..."}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="p-0 w-(--radix-popover-trigger-width)">
          <Command>
            <CommandInput placeholder="Buscar carrera..." />
            <CommandList>
              <CommandEmpty>
                <span className="text-sm text-slate-500 dark:text-slate-400">Sin resultados.</span>
              </CommandEmpty>
              <CommandGroup>
                {pensums.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.carrera}
                    onSelect={() => {
                      setValor(p.id);
                      setAbierto(false);
                    }}
                  >
                    <Check className={clsx("mr-2 h-4 w-4", valor === p.id ? "opacity-100" : "opacity-0")} />
                    {p.carrera}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
