import Link from "next/link";
import {
  IconClock as Clock,
  IconAlertCircle as AlertCircle,
  IconCircleCheck as CheckCircle2,
  IconCircleX as XCircle,
  IconFileText as FileText,
  IconInbox as Inbox,
  IconSchool as School,
  IconCalendar as Calendar,
  IconClipboardList as ClipboardList,
  type Icon as LucideIcon,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/encabezado";
import type { EstadoCaso } from "@/types";

// Pantalla "Mis homologaciones": el estudiante ve los casos que ya envió y en qué estado va cada
// uno. Es de SOLO LECTURA —no puede editar ni elegir qué se homologa—; aquí solo consulta el
// avance. La RLS de `caso` ya limita la consulta a sus propios casos, pero igual filtramos por
// estudiante_id para que sea explícito (y para que un admin que entre aquí no vea los de todos).

// Cómo mostramos cada estado del caso al estudiante: etiqueta amable, color del badge, icono y una
// frase corta que explica qué está pasando. Es el espejo "de cara al estudiante" del enum
// estado_caso de la migración 0002.
const ESTADO_UI: Record<
  EstadoCaso,
  { etiqueta: string; clases: string; Icono: LucideIcon; descripcion: string }
> = {
  procesando: {
    etiqueta: "En proceso",
    clases: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30",
    Icono: Clock,
    descripcion: "Estamos analizando tu certificado de notas.",
  },
  en_revision: {
    etiqueta: "En revisión",
    clases: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    Icono: AlertCircle,
    descripcion: "Ábrela para ver tu posible homologación mientras un asesor la revisa.",
  },
  aprobado: {
    etiqueta: "Aprobada",
    clases: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30",
    Icono: CheckCircle2,
    descripcion: "¡Tu homologación fue aprobada!",
  },
  rechazado: {
    etiqueta: "No aprobada",
    clases: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30",
    Icono: XCircle,
    descripcion: "Tu solicitud no fue aprobada.",
  },
};

// Forma de cada fila que pedimos a Supabase. `pensum` llega como objeto (relación a-uno) porque
// caso.pensum_destino_id apunta a un único pensum.
type CasoFila = {
  id: string;
  institucion_origen_nombre: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  creado_en: string;
  pensum: { carrera: string; version: string } | null;
};

// Fecha legible en español neutro, ej. "22 jun 2026".
function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function PaginaMisHomologaciones() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("caso")
    .select(
      "id, institucion_origen_nombre, estado, semestre_sugerido, creado_en, pensum:pensum_destino_id (carrera, version)",
    )
    .eq("estudiante_id", user?.id ?? "")
    .order("creado_en", { ascending: false });

  const casos = (data ?? []) as unknown as CasoFila[];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Mis homologaciones"
        descripcion="Aquí sigues el avance de cada solicitud que enviaste."
        icono={ClipboardList}
      />

      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {casos.length === 0 ? (
            // Estado vacío: todavía no envió ninguna solicitud.
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 shadow-sm text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                <Inbox className="w-8 h-8" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-800 dark:text-slate-200">
                Aún no tienes homologaciones
              </h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Cuando envíes tu primera solicitud, podrás seguir su avance desde aquí.
              </p>
              <Button asChild className="mt-6">
                <Link href="/homologar">Iniciar una homologación</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {casos.map((caso) => {
                const ui = ESTADO_UI[caso.estado];
                return (
                  <li key={caso.id}>
                    <Link
                      href={`/mis-homologaciones/${caso.id}`}
                      className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:border-blue-300 hover:shadow transition-all"
                    >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                          {caso.pensum?.carrera ?? "Carrera no disponible"}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <School className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            {caso.institucion_origen_nombre}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            {formatearFecha(caso.creado_en)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${ui.clases}`}
                      >
                        <ui.Icono className="w-3.5 h-3.5" />
                        {ui.etiqueta}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>
                        {ui.descripcion}
                        {/* El semestre estimado es el dato que más le importa al estudiante: lo
                            mostramos como aproximado en revisión y como definitivo si fue aprobada. */}
                        {(caso.estado === "aprobado" || caso.estado === "en_revision") &&
                          caso.semestre_sugerido != null && (
                            <>
                              {" "}
                              {caso.estado === "aprobado"
                                ? "Quedarías en el"
                                : "Quedarías aprox. en el"}{" "}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                semestre {caso.semestre_sugerido}
                              </span>
                              .
                            </>
                          )}
                      </span>
                    </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
