"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Briefcase, BookOpen, BarChart3, Settings, LayoutGrid } from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const pathname = usePathname();
  const navItems = [
    { to: "/casos", icon: Briefcase, label: "Casos de Estudio" },
    { to: "/carreras", icon: BookOpen, label: "Planes Académicos" },
    { to: "/reportes", icon: BarChart3, label: "Reportes" },
  ];

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
        <div className="flex items-center space-x-3 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">Juan Decano</p>
            <p className="text-xs text-slate-500 truncate">Administrador</p>
          </div>
          <Settings className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
