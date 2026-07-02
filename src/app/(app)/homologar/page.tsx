import { IconFileText as FileText } from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import { FormularioHomologacion } from "./formulario";
import { OnboardingHomologar } from "./onboarding";

// El envío corre el pipeline de IA (validar + extraer + emparejar, y OCR por visión si el PDF está
// escaneado), que puede esperar varios segundos ante rate-limits de Groq. Sin esto, Vercel corta la
// función a los ~10s por defecto y el caso queda a medias.
export const maxDuration = 60;

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
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Homologar mi carrera"
        descripcion="Sube tu certificado, elige la carrera y deja tus datos. Nuestro equipo revisa; tú solo envías."
        icono={FileText}
      />

      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <FormularioHomologacion pensums={pensums ?? []} />
        </div>
      </main>

      {/* Intro interactiva la primera vez (bienvenida + coachmarks). Se autogestiona con localStorage. */}
      <OnboardingHomologar />
    </div>
  );
}
