import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { gradienteDe } from "@/lib/marca/fondos";
import { Logotipo } from "@/components/logotipo";
import { PanelMarca } from "./panel-marca";
import { FormularioLogin } from "./formulario-login";

// Pantalla de ingreso (solo el admin inicia sesión). Layout a DOS PANELES: a la izquierda la cara de
// marca (degradado elegido + partículas + logo/eslogan), a la derecha el formulario sobre un fondo
// con textura sutil. En móvil se oculta el panel de marca y queda una cabecera compacta.
export default async function PaginaIngresar() {
  const cfg = await obtenerConfiguracion();
  const gradiente = gradienteDe(cfg.fondoLogin);

  return (
    <div className="min-h-screen flex font-sans">
      <PanelMarca marca={cfg} gradiente={gradiente} />

      {/* Panel derecho: superficie limpia y quieta. Antes tenía grilla de puntos y dos resplandores
          difuminados; con el panel de marca al lado ya hay suficiente color, y competir con él solo
          restaba foco al formulario, que es lo único que se viene a hacer aquí. */}
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
            Acceso exclusivo para administradores.
          </p>
          <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
            <a href="/privacidad" className="hover:text-slate-600 hover:underline">
              Política de tratamiento de datos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
