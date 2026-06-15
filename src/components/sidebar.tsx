"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  BookOpen,
  BarChart3,
  FileText,
  LogOut,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

import type { Perfil, Rol } from "@/types";
import { cerrarSesion } from "@/lib/auth/acciones";

type ItemNav = { to: string; icon: LucideIcon; label: string };

// Cada rol ve su propia navegación: el estudiante solo su flujo de homologación; el admin, la
// bandeja de casos y la gestión académica.
const NAV_POR_ROL: Record<Rol, ItemNav[]> = {
  estudiante: [{ to: "/homologar", icon: FileText, label: "Homologar" }],
  admin: [
    { to: "/casos", icon: Briefcase, label: "Casos de Estudio" },
    { to: "/carreras", icon: BookOpen, label: "Planes Académicos" },
    { to: "/reportes", icon: BarChart3, label: "Reportes" },
  ],
};

const ETIQUETA_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  admin: "Administrador",
};

// Iniciales para el avatar: la primera letra de las dos primeras palabras del nombre.
function inicialesDe(nombre: string) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? "")
    .join("");
  return iniciales || "?";
}

export function Sidebar({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const navItems = NAV_POR_ROL[perfil.rol];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
      <div className="p-6 flex items-center space-x-3">
        <div className="bg-blue-800 p-2 rounded-lg">
          <LayoutGrid className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">TransfoEdu</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            href={item.to}
            className={clsx(
              "flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition-colors",
              pathname.startsWith(item.to)
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold">
            {inicialesDe(perfil.nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{perfil.nombre}</p>
            <p className="text-xs text-slate-500 truncate">{ETIQUETA_ROL[perfil.rol]}</p>
          </div>
          {/* signOut es una server action; un <form> es la forma más simple de invocarla. */}
          <form action={cerrarSesion}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="text-slate-400 hover:text-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
