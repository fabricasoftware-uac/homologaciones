"use client";

import { useState } from "react";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { BotonTema } from "@/components/boton-tema";
import type { Perfil } from "@/types";
import type { Configuracion } from "@/lib/marca/configuracion";

// Marco visual de la app del lado cliente: sostiene el estado de "sidebar visible/oculto" para que
// el admin pueda esconder el menú en escritorio. Al ocultarlo/mostrarlo, el sidebar se DESLIZA con
// un resorte (antes se cortaba de golpe). El layout (server) le pasa el perfil, la marca y las
// páginas hijas ya renderizadas.
export function AppShell({
  perfil,
  marca,
  children,
}: {
  perfil: Perfil;
  marca: Configuracion;
  children: React.ReactNode;
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950 font-sans">
      <AnimatePresence initial={false}>
        {sidebarVisible && (
          <motion.div
            key="sidebar"
            initial={{ width: 0 }}
            animate={{ width: "16rem" }}
            exit={{ width: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
            className="hidden md:block overflow-hidden shrink-0 sticky top-0 h-dvh self-start"
          >
            <Sidebar perfil={perfil} marca={marca} onOcultar={() => setSidebarVisible(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 md:hidden shrink-0 sticky top-0 z-30">
          <MobileNav perfil={perfil} marca={marca} />
          <span className="font-bold text-slate-900 dark:text-slate-100 truncate flex-1">{marca.nombre}</span>
          <BotonTema className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" />
        </header>

        {/* Scroll de VENTANA (documento): el contenido fluye natural y scrollea el navegador; el
            sidebar y el header móvil son sticky para quedar fijos. Así no hay scroll anidado.
            @container: las grillas internas (KPIs, paneles) responden al ancho REAL del contenido. */}
        <div className="flex-1 @container">{children}</div>
      </main>

      {/* Botón flotante para volver a mostrar el menú cuando está oculto (solo escritorio). */}
      <AnimatePresence>
        {!sidebarVisible && (
          <motion.button
            key="mostrar-menu"
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarVisible(true)}
            aria-label="Mostrar menú"
            title="Mostrar menú"
            className="hidden md:inline-flex items-center gap-2 fixed bottom-4 left-4 z-50 h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 shadow-lg text-slate-200 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <IconLayoutSidebarLeftExpand className="w-5 h-5" />
            Menú
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
