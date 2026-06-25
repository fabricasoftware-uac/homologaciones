import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconChevronLeft as ChevronLeft,
  IconClock as Clock,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  type Icon as LucideIcon,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EstadoCaso } from "@/types";
import { EscuchaCaso } from "@/components/escucha-caso";
import {
  ResultadoHomologacion,
  type HomologacionFila,
} from "@/components/resultado-homologacion";

// Detalle de una homologación, del lado del ESTUDIANTE. Es de solo lectura: la RLS "Ver mis casos"
// garantiza que solo pueda abrir los suyos (si pone el id de otro, no encuentra nada -> notFound).
//
// El cuerpo del resultado (estimación / resultado final / comparación / nota / acta) vive en el
// componente compartido ResultadoHomologacion, que también usa la página pública de seguimiento.

// Etiqueta + color del badge de estado en el encabezado.
const BADGE: Record<EstadoCaso, { etiqueta: string; clases: string; Icono: LucideIcon }> = {
  procesando: { etiqueta: "En proceso", clases: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30", Icono: Clock },
  en_revision: { etiqueta: "En revisión", clases: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30", Icono: Clock },
  aprobado: { etiqueta: "Aprobada", clases: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30", Icono: CheckCircle2 },
  rechazado: { etiqueta: "No aprobada", clases: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30", Icono: XCircle },
};

type CasoDetalle = {
  id: string;
  institucion_origen_nombre: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  nota_admin: string | null;
  pensum: { carrera: string; version: string } | null;
};

export default async function PaginaDetalleHomologacion({ params }: { params: { id: string } }) {
  const supabase = crearClienteServidor();

  const { data: casoData } = await supabase
    .from("caso")
    .select("id, institucion_origen_nombre, estado, semestre_sugerido, nota_admin, pensum:pensum_destino_id (carrera, version)")
    .eq("id", params.id)
    .single();

  if (!casoData) {
    notFound();
  }
  const caso = casoData as unknown as CasoDetalle;
  const badge = BADGE[caso.estado];

  // Aprobado -> el resultado final (solo vínculos aprobados por el admin). En revisión -> el
  // aproximado de la IA (todo lo que NO descartó el admin). En ambos casos es de solo lectura.
  const aprobado = caso.estado === "aprobado";
  const esPosible = caso.estado === "en_revision";

  let homologadas: HomologacionFila[] = [];
  if (aprobado || esPosible) {
    let consulta = supabase
      .from("vinculo")
      .select(
        "id, materia_origen:materia_origen_id (nombre, creditos), asignatura:asignatura_id (nombre, semestre, creditos)",
      )
      .eq("caso_id", params.id);
    consulta = aprobado ? consulta.eq("estado", "aprobado") : consulta.neq("estado", "rechazado");
    const { data } = await consulta;
    homologadas = (data ?? []) as unknown as HomologacionFila[];
  }

  // Ordenamos por semestre de la asignatura destino (y luego por nombre) para que el resumen se lea
  // de menor a mayor, como avanza la carrera.
  homologadas.sort((a, b) => {
    const sa = a.asignatura?.semestre ?? 99;
    const sb = b.asignatura?.semestre ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.asignatura?.nombre ?? "").localeCompare(b.asignatura?.nombre ?? "", "es");
  });

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      {/* Refresca esta vista en vivo cuando el admin decide el caso (no mientras está cerrado). */}
      {!aprobado && caso.estado !== "rechazado" && <EscuchaCaso casoId={caso.id} />}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <Link href="/mis-homologaciones" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
            {caso.pensum?.carrera ?? "Carrera no disponible"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Desde {caso.institucion_origen_nombre}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${badge.clases}`}
        >
          <badge.Icono className="w-3.5 h-3.5" />
          {badge.etiqueta}
        </span>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <ResultadoHomologacion
          estado={caso.estado}
          semestre={caso.semestre_sugerido}
          notaAdmin={caso.nota_admin}
          homologadas={homologadas}
          actaHref={aprobado ? `/mis-homologaciones/${caso.id}/acta` : null}
        />
      </main>
    </div>
  );
}
