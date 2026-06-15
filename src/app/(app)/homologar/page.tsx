import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioHomologacion } from "./formulario";

// Pantalla principal del estudiante: arma la solicitud de homologación. Cargamos en el servidor
// las carreras destino activas para llenar el desplegable del formulario.
export default async function PaginaHomologar() {
  const supabase = crearClienteServidor();
  const { data: pensums } = await supabase
    .from("pensum")
    .select("id, carrera, version")
    .eq("activo", true)
    .order("carrera");

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto">
      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Homologar mi carrera
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Sube tu certificado de notas y elige la carrera que quieres cursar en la Autónoma del
          Cauca. La revisión la hace nuestro equipo; tú solo envías.
        </p>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <FormularioHomologacion pensums={pensums ?? []} />
        </div>
      </main>
    </div>
  );
}
