import type { Icon as LucideIcon } from "@tabler/icons-react";

// Encabezado de página compartido: una barra superior pegajosa, translúcida, con un ícono en el
// color de marca, el título, una descripción y un espacio opcional para acciones a la derecha.
// Unifica el look de todas las secciones (antes cada página repetía su propio header).
export function EncabezadoPagina({
  titulo,
  descripcion,
  icono: Icono,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: React.ReactNode;
}) {
  // Scroll de ventana: el encabezado es sticky al documento. En móvil se pega DEBAJO del header móvil
  // (h-16); en escritorio (sin header móvil) se pega arriba del todo.
  return (
    <header className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-5 sticky top-16 md:top-0 z-20">
      {/* El título y la acción (buscador, filtros) se apilan hasta xl: la acción baja a su propia
          fila para que la descripción nunca se comprima. Solo en pantallas anchas (xl+, donde sí hay
          espacio para la acción ancha) van en la misma fila. */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {Icono && (
            // En claro: chip con el color de marca. En oscuro: chip NEUTRO (superficie elevada), para
            // que combine con cualquier paleta oscura (incluidas las de color como Medianoche/Índigo).
            <div className="hidden sm:flex w-11 h-11 rounded-xl bg-marca/10 text-marca dark:bg-white/10 dark:text-slate-100 items-center justify-center shrink-0">
              <Icono className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
              {titulo}
            </h1>
            {descripcion && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{descripcion}</p>
            )}
          </div>
        </div>
        {accion && <div className="shrink-0 xl:ml-auto">{accion}</div>}
      </div>
    </header>
  );
}
