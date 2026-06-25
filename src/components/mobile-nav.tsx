"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2 as Menu } from "@tabler/icons-react";
import clsx from "clsx";

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import type { Perfil } from "@/types";
import type { Configuracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";
import { NAV_POR_ROL } from "./sidebar";

// Navegación para móvil/tablet: un botón hamburguesa que abre un panel lateral (Sheet) con los
// mismos ítems del sidebar, en el mismo estilo oscuro. En pantallas medianas se usa el sidebar.
export function MobileNav({
  perfil,
  marca,
}: {
  perfil: Perfil;
  marca: Pick<Configuracion, "nombre" | "logoUrl" | "logoOscuroUrl">;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const items = NAV_POR_ROL[perfil.rol];

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menú"
          className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-800 text-slate-300">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div className="p-4 flex items-center gap-3">
          <Logotipo marca={marca} size="md" fondo="oscuro" />
          <span className="text-base font-semibold text-white tracking-tight truncate">
            {marca.nombre}
          </span>
        </div>
        <nav className="px-3 py-2 space-y-1">
          {items.map((item) => {
            const activo = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setAbierto(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activo
                    ? "bg-white/[0.07] text-white ring-1 ring-white/10"
                    : "text-slate-400 dark:text-slate-500 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className={clsx("w-[18px] h-[18px]", activo ? "text-marca" : "")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
