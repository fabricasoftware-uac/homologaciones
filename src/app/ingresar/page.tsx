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

      {/* Panel derecho: ya no es un simple blanco. Lleva un patrón de puntos tenue y dos resplandores
          de marca difuminados para darle textura y profundidad. */}
      <div className="relative flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-marca/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-acento/10 blur-3xl" />

        <div className="relative w-full max-w-sm">
          {/* Cabecera de marca compacta: solo en móvil/tablet (en escritorio está el panel izq.). */}
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <Logotipo marca={cfg} size="lg" className="mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{cfg.nombre}</h1>
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
