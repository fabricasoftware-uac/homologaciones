import Link from "next/link";
import { redirect } from "next/navigation";
import { IconFilePlus as FilePlus, IconChevronLeft as ChevronLeft } from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import type { Rol } from "@/types";
import { FormularioNuevoCaso } from "./formulario-nuevo-caso";

export const maxDuration = 60;

export default async function PaginaNuevoCaso() {
  const supabase = crearClienteServidor();

  // 1. Verificación de permisos: solo staff (admin o asesor)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ingresar");
  }

  const { data: perfilData } = await supabase
    .from("perfil")
    .select("rol")
    .eq("id", user.id)
    .single();

  const rol: Rol = (perfilData as { rol: Rol } | null)?.rol ?? "estudiante";
  if (rol !== "admin" && rol !== "asesor") {
    redirect("/casos");
  }

  // 2. Consulta de pensums activos
  const { data: pensums } = await supabase
    .from("pensum")
    .select("id, carrera, version")
    .eq("activo", true)
    .order("carrera");

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-full flex flex-col">
      <EncabezadoPagina
        titulo="Registrar caso de homologación"
        descripcion="Crea un nuevo estudio a partir del expediente físico del aspirante e inicia el análisis automático con IA."
        icono={FilePlus}
        accion={
          <Link
            href="/casos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a la bandeja
          </Link>
        }
      />

      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <FormularioNuevoCaso pensums={pensums ?? []} />
        </div>
      </main>
    </div>
  );
}
