"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconSearch as Search, IconX as X } from "@tabler/icons-react";

// Buscador de la bandeja: filtra por nombre, correo o institución de origen. Escribe ?q= en la URL
// (con un pequeño debounce para no navegar en cada tecla); el servidor lee y filtra. Conserva el
// resto de parámetros (fecha, estado) y resetea la paginación.
export function BuscadorCasos() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [valor, setValor] = useState(params.get("q") ?? "");
  // Evita navegar en el primer render (cuando el valor ya viene de la URL).
  const montado = useRef(false);

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params);
      const limpio = valor.trim();
      if (limpio) sp.set("q", limpio);
      else sp.delete("q");
      sp.delete("page");
      const query = sp.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    }, 350);
    return () => clearTimeout(t);
    // params/pathname/router son estables para este efecto; solo nos interesa reaccionar al valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar por nombre, correo o institución…"
        className="w-full sm:w-72 pl-9 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-marca/30 focus:border-marca outline-none transition-all"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
