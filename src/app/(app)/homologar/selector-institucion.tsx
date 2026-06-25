"use client";

import { useState } from "react";
import { IconCheck as Check, IconSelector as ChevronsUpDown, IconPencil as PencilLine } from "@tabler/icons-react";
import clsx from "clsx";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { INSTITUCIONES_ORIGEN } from "@/data/instituciones-origen";

// Buscador de institución de origen: el estudiante elige su universidad del catálogo o, si no
// aparece, la escribe a mano. En ambos casos guardamos solo el NOMBRE (texto) en un input oculto
// con el `name` que espera la server action, así el resto del formulario no cambia.
//
// Filtramos la lista nosotros (shouldFilter={false} en Command) para poder ofrecer la opción de
// "usar lo escrito" cuando no hay coincidencia exacta: cmdk, con su filtro propio, escondería esa
// opción porque su texto no calza con la búsqueda.
export function SelectorInstitucion({ name }: { name: string }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(""); // lo elegido/escrito que viaja en el formulario
  const [busqueda, setBusqueda] = useState(""); // texto del campo de búsqueda

  const consulta = busqueda.trim();
  const filtradas = consulta
    ? INSTITUCIONES_ORIGEN.filter((inst) =>
        inst.toLowerCase().includes(consulta.toLowerCase()),
      )
    : INSTITUCIONES_ORIGEN;

  // Solo ofrecemos la entrada manual si hay texto y no coincide EXACTO con algo de la lista (para
  // no duplicar una opción que ya existe).
  const hayExacta = INSTITUCIONES_ORIGEN.some(
    (inst) => inst.toLowerCase() === consulta.toLowerCase(),
  );
  const mostrarManual = consulta.length > 0 && !hayExacta;

  function elegir(nombre: string) {
    setValor(nombre);
    setBusqueda("");
    setAbierto(false);
  }

  return (
    <>
      {/* Campo real que viaja en el FormData; la validación de no-vacío la hace la server action. */}
      <input type="hidden" name={name} value={valor} />

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-left"
          >
            <span className={clsx("truncate", valor ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500")}>
              {valor || "Busca o escribe tu universidad..."}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="p-0 w-(--radix-popover-trigger-width)"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar institución..."
              value={busqueda}
              onValueChange={setBusqueda}
            />
            <CommandList>
              {mostrarManual && (
                <CommandGroup heading="¿No está en la lista?">
                  <CommandItem value="__manual__" onSelect={() => elegir(consulta)}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Usar &ldquo;{consulta}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}

              {filtradas.length > 0 && (
                <CommandGroup heading="Instituciones">
                  {filtradas.map((inst) => (
                    <CommandItem key={inst} value={inst} onSelect={() => elegir(inst)}>
                      <Check
                        className={clsx(
                          "mr-2 h-4 w-4",
                          valor === inst ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {inst}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filtradas.length === 0 && !mostrarManual && (
                <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  Escribe el nombre de tu universidad.
                </p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
