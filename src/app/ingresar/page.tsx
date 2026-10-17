import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { gradienteDe } from "@/lib/marca/fondos";
import { Logotipo } from "@/components/logotipo";
import type { Rol } from "@/types";
import { PanelMarca } from "./panel-marca";
import { FormularioLogin } from "./formulario-login";

// Pantalla de ingreso institucional. Layout a DOS PANELES: a la izquierda la cara de
// marca (degradado elegido + partículas + logo/eslogan), a la derecha el formulario sobre un fondo
// con textura sutil. En móvil se oculta el panel de marca y queda una cabecera compacta.
export default async function PaginaIngresar() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.is_anonymous) {
    const { data } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
    const rol = (data as { rol: Rol } | null)?.rol;
    if (rol === "admin") {
      redirect("/inicio");
    }
    redirect("/casos");
  }

  const cfg = await obtenerConfiguracion();
  const gradiente = gradienteDe(cfg.fondoLogin);

  return (
    <div className="min-h-screen flex font-sans">
      <PanelMarca marca={cfg} gradiente={gradiente} />

      {/* Panel derecho: formulario de acceso institucional */}
      <div className="relative flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50 dark:bg-slate-950">
        <div className="relative w-full max-w-sm">
          {/* Cabecera de marca compacta: solo en móvil/tablet (en escritorio está el panel izq.). */}
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <Logotipo marca={cfg} size="lg" className="mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {cfg.nombre}
            </h1>
            {cfg.eslogan && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{cfg.eslogan}</p>}
          </div>

          <FormularioLogin marca={cfg} gradiente={gradiente} />

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Acceso institucional para coordinadores, directivos y administradores de la Uniautónoma.
          </p>
          <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
            <a href="/privacidad" className="hover:text-slate-600 hover:underline">
              Política de tratamiento de datos
            </a>
          </p>

          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-500">
            <p className="font-medium text-slate-600 dark:text-slate-400">Desarrollado por la Fábrica de Software</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Powered by <span className="font-semibold text-slate-700 dark:text-slate-300">Emprendelab</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
