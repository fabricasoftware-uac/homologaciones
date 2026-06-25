import { IconSettings as Settings } from "@tabler/icons-react";

import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { EncabezadoPagina } from "@/components/encabezado";
import { FormularioMarca } from "./formulario";

// Panel de personalización (white-label). Solo admin (lo protege el middleware por rol). Desde aquí
// la institución pone su nombre, su logo y sus colores, y se aplican en toda la app.
export default async function PaginaConfiguracion() {
  const cfg = await obtenerConfiguracion();

  // Flujo natural: el contenido crece y scrollea la VENTANA del navegador (un único scroll, como toda
  // la app desde el cambio a scroll de ventana). El encabezado es sticky, así que queda fijo arriba.
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Personaliza la apariencia: nombre, logo y colores de tu institución."
        icono={Settings}
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <FormularioMarca inicial={cfg} />
        </div>
      </main>
    </div>
  );
}
