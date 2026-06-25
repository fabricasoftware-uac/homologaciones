"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  IconLayoutDashboard as LayoutDashboard,
  IconBriefcase as Briefcase,
  IconBook as BookOpen,
  IconChartBar as BarChart3,
  IconHome as Home,
  IconFileText as FileText,
  IconClipboardList as ClipboardList,
  IconLogout as LogOut,
  IconSettings as Settings,
  IconUsers as Users,
  IconLayoutSidebarLeftCollapse as PanelLeftClose,
  type Icon as LucideIcon,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import clsx from "clsx";

import type { Perfil, Rol } from "@/types";
import type { Configuracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";
import { Campana } from "@/components/campana";
import { BotonTema } from "@/components/boton-tema";
import { cerrarSesion } from "@/lib/auth/acciones";

export type ItemNav = { to: string; icon: LucideIcon; label: string };

// Cada rol ve su propia navegación: el estudiante solo su flujo de homologación; el admin, la
// bandeja de casos, la gestión académica y la personalización. Se exporta para el menú móvil.
export const NAV_POR_ROL: Record<Rol, ItemNav[]> = {
  estudiante: [
    { to: "/", icon: Home, label: "Inicio" },
    { to: "/homologar", icon: FileText, label: "Homologar" },
    { to: "/mis-homologaciones", icon: ClipboardList, label: "Mis homologaciones" },
  ],
  admin: [
    { to: "/inicio", icon: LayoutDashboard, label: "Inicio" },
    { to: "/casos", icon: Briefcase, label: "Casos de estudio" },
    { to: "/carreras", icon: BookOpen, label: "Planes académicos" },
    { to: "/reportes", icon: BarChart3, label: "Reportes" },
    { to: "/usuarios", icon: Users, label: "Usuarios" },
    { to: "/configuracion", icon: Settings, label: "Configuración" },
  ],
};

const ETIQUETA_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  admin: "Administrador",
};

const RESORTE = { type: "spring", stiffness: 520, damping: 42 } as const;

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

// Sidebar premium (grafito) con el color de la institución como acento. El ítem activo lleva un
// indicador que se desliza entre opciones (animación con layoutId de motion: liviana pero marca la
// diferencia). Fondo oscuro fijo; lo que cambia con la marca es el acento.
export function Sidebar({
  perfil,
  marca,
  onOcultar,
}: {
  perfil: Perfil;
  marca: Pick<Configuracion, "nombre" | "logoUrl" | "logoOscuroUrl">;
  onOcultar?: () => void;
}) {
  const pathname = usePathname();
  const navItems = NAV_POR_ROL[perfil.rol];

  return (
    <aside className="w-64 h-full bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col">
      <div className="p-4 flex items-center gap-3">
        <Logotipo marca={marca} size="md" fondo="oscuro" />
        <span className="flex-1 min-w-0 text-base font-semibold text-white tracking-tight truncate">
          {marca.nombre}
        </span>
        {perfil.rol === "admin" && <Campana />}
        {onOcultar && (
          <button
            type="button"
            onClick={onOcultar}
            aria-label="Ocultar menú"
            title="Ocultar menú"
            className="text-slate-500 hover:text-white transition-colors"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
          // "/" (Inicio) requiere match exacto; el resto, prefijo (para subrutas como /casos/123).
          const activo = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={clsx(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                !activo && "hover:bg-white/5",
              )}
            >
              {activo && (
                <>
                  <motion.span
                    layoutId="nav-fondo"
                    transition={RESORTE}
                    className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-white/10"
                  />
                  <motion.span
                    layoutId="nav-barra"
                    transition={RESORTE}
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-marca"
                  />
                </>
              )}
              <item.icon
                className={clsx(
                  "w-[18px] h-[18px] relative z-10 transition-colors",
                  activo ? "text-marca" : "text-slate-400 group-hover:text-white",
                )}
              />
              <span
                className={clsx(
                  "relative z-10 text-sm font-medium transition-colors",
                  activo ? "text-white" : "text-slate-400 group-hover:text-white",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="w-9 h-9 rounded-full bg-marca text-marca-fg flex items-center justify-center text-sm font-bold shrink-0">
            {inicialesDe(perfil.nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{perfil.nombre}</p>
            <p className="text-xs text-slate-500 truncate">{ETIQUETA_ROL[perfil.rol]}</p>
          </div>
          {/* Tema y cerrar sesión: mismas cajas (w-8 h-8 centradas) para que queden alineados. */}
          <BotonTema className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 shrink-0" />
          {/* Solo el admin inicia sesión; al invitado un "cerrar sesión" lo confundiría. */}
          {perfil.rol === "admin" && (
            <form action={cerrarSesion} className="flex shrink-0">
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
