import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  IconClock as Clock,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  type Icon as LucideIcon,
} from "@tabler/icons-react";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";
import type { EstadoCaso } from "@/types";
import {
  ResultadoHomologacion,
  type HomologacionFila,
} from "@/components/resultado-homologacion";

export const metadata: Metadata = {
  title: "Seguimiento de tu homologación",
};

// Página PÚBLICA de seguimiento: el invitado que perdió su sesión anónima vuelve a su caso desde el
// enlace del correo (que lleva su token). Se lee con el cliente de SERVICIO (por token, saltándose la
// RLS) y se muestra de solo lectura con el mismo componente que el detalle del estudiante.

const BADGE: Record<EstadoCaso, { etiqueta: string; clases: string; Icono: LucideIcon }> = {
  procesando: { etiqueta: "En proceso", clases: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30", Icono: Clock },
  en_revision: { etiqueta: "En revisión", clases: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30", Icono: Clock },
  aprobado: { etiqueta: "Aprobada", clases: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30", Icono: CheckCircle2 },
  rechazado: { etiqueta: "No aprobada", clases: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30", Icono: XCircle },
};

type CasoSeguimiento = {
  id: string;
  institucion_origen_nombre: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  nota_admin: string | null;
  pensum: { carrera: string } | null;
};

export default async function PaginaSeguimiento({ params }: { params: { token: string } }) {
  const servicio = crearClienteServicio();

  const { data: casoData } = await servicio
    .from("caso")
    .select(
      "id, institucion_origen_nombre, estado, semestre_sugerido, nota_admin, pensum:pensum_destino_id (carrera)",
    )
    .eq("token_seguimiento", params.token)
    .single();

  if (!casoData) {
    notFound();
  }
  const caso = casoData as unknown as CasoSeguimiento;
  const badge = BADGE[caso.estado];

  const aprobado = caso.estado === "aprobado";
  const esPosible = caso.estado === "en_revision";

  let homologadas: HomologacionFila[] = [];
  if (aprobado || esPosible) {
    let consulta = servicio
      .from("vinculo")
      .select(
        "id, materia_origen:materia_origen_id (nombre, creditos), asignatura:asignatura_id (nombre, semestre, creditos)",
      )
      .eq("caso_id", caso.id);
    consulta = aprobado ? consulta.eq("estado", "aprobado") : consulta.neq("estado", "rechazado");
    const { data } = await consulta;
    homologadas = (data ?? []) as unknown as HomologacionFila[];
  }

  homologadas.sort((a, b) => {
    const sa = a.asignatura?.semestre ?? 99;
    const sb = b.asignatura?.semestre ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.asignatura?.nombre ?? "").localeCompare(b.asignatura?.nombre ?? "", "es");
  });

  const cfg = await obtenerConfiguracion();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Logotipo marca={cfg} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {caso.pensum?.carrera ?? "Tu homologación"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Desde {caso.institucion_origen_nombre}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${badge.clases}`}
          >
            <badge.Icono className="w-3.5 h-3.5" />
            {badge.etiqueta}
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <ResultadoHomologacion
          estado={caso.estado}
          semestre={caso.semestre_sugerido}
          notaAdmin={caso.nota_admin}
          homologadas={homologadas}
          actaHref={aprobado ? `/seguimiento/${params.token}/acta` : null}
        />
      </main>
    </div>
  );
}
