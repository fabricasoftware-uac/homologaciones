import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconChevronLeft as ChevronLeft,
  IconArrowRight as ArrowRight,
  IconUser as User,
  IconMail as Mail,
  IconPhone as Phone,
  IconBrandWhatsapp as Whatsapp,
  IconPaperclip as Paperclip,
} from "@tabler/icons-react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import type { EstadoCaso } from "@/types";
import {
  EstudioHomologacion,
  type MateriaStudio,
  type AsignaturaStudio,
  type VinculoStudio,
} from "./estudio";
import { ResumenCaso } from "./resumen";

const ESTADO_CASO_UI: Record<EstadoCaso, { etiqueta: string; clases: string }> = {
  procesando: { etiqueta: "Procesando", clases: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30" },
  en_revision: { etiqueta: "Por revisar", clases: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30" },
  aprobado: { etiqueta: "Aprobado", clases: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30" },
  rechazado: { etiqueta: "Rechazado", clases: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30" },
};

type CasoDetalle = {
  id: string;
  institucion_origen_nombre: string;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  pensum_destino_id: string;
  archivo_pdf: string | null;
  nota_admin: string | null;
  nota_interna: string | null;
  decidido_en: string | null;
  decididoPor: { nombre: string } | null;
  solicitante_nombre: string | null;
  solicitante_celular: string | null;
  solicitante_correo: string | null;
  pensum: { carrera: string; archivo_pdf: string | null } | null;
};

// Arma el enlace de WhatsApp (wa.me) a partir del celular del solicitante. Normaliza a formato
// internacional: si son 10 dígitos (celular colombiano) antepone 57; si ya trae indicativo, lo deja.
function urlWhatsApp(celular: string, mensaje: string): string {
  const digitos = celular.replace(/\D/g, "");
  const internacional = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}

export default async function PaginaRevisarCaso({ params }: { params: { id: string } }) {
  const supabase = crearClienteServidor();

  const { data: casoData } = await supabase
    .from("caso")
    .select(
      "id, institucion_origen_nombre, estado, semestre_sugerido, pensum_destino_id, archivo_pdf, nota_admin, nota_interna, decidido_en, decididoPor:decidido_por (nombre), solicitante_nombre, solicitante_celular, solicitante_correo, pensum:pensum_destino_id (carrera, archivo_pdf)",
    )
    .eq("id", params.id)
    .single();

  if (!casoData) {
    notFound();
  }
  const caso = casoData as unknown as CasoDetalle;

  const [{ data: materiasData }, { data: asignaturasData }, { data: vinculosData }] =
    await Promise.all([
      supabase
        .from("materia_origen")
        .select("id, codigo, nombre, creditos, nota, semestre_origen")
        .eq("caso_id", params.id)
        .order("semestre_origen", { nullsFirst: false }),
      supabase
        .from("asignatura")
        .select("id, codigo, nombre, creditos, semestre")
        .eq("pensum_id", caso.pensum_destino_id)
        .order("semestre"),
      supabase
        .from("vinculo")
        .select("id, materia_origen_id, asignatura_id, similitud, razon, estado")
        .eq("caso_id", params.id),
    ]);

  const materias: MateriaStudio[] = (
    (materiasData ?? []) as {
      id: string;
      codigo: string | null;
      nombre: string;
      creditos: number | null;
      nota: string | null;
      semestre_origen: number | null;
    }[]
  ).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    nombre: m.nombre,
    creditos: m.creditos,
    nota: m.nota,
    semestre: m.semestre_origen,
  }));

  const asignaturas: AsignaturaStudio[] = (asignaturasData ?? []) as unknown as AsignaturaStudio[];

  const vinculos: VinculoStudio[] = (
    (vinculosData ?? []) as {
      id: string;
      materia_origen_id: string;
      asignatura_id: string;
      similitud: number;
      razon: string | null;
      estado: VinculoStudio["estado"];
    }[]
  ).map((v) => ({
    id: v.id,
    materiaOrigenId: v.materia_origen_id,
    asignaturaId: v.asignatura_id,
    similitud: v.similitud,
    razon: v.razon,
    estado: v.estado,
  }));

  const uiCaso = ESTADO_CASO_UI[caso.estado];
  const cerrado = caso.estado === "aprobado" || caso.estado === "rechazado";

  // Umbral de nota mínima (configurable) para los avisos del estudio.
  const cfg = await obtenerConfiguracion();

  // Plantillas de nota reutilizables (para insertar en la nota al estudiante).
  const { data: plantillasData } = await supabase
    .from("plantilla_nota")
    .select("id, texto")
    .order("creado_en");
  const plantillas = (plantillasData ?? []) as { id: string; texto: string }[];

  const servicio = crearClienteServicio();

  // URL firmada (válida 1 hora) para que el admin pueda abrir el certificado del estudiante: el
  // bucket 'certificados' es privado, así que no sirve una URL pública. Usamos el cliente de
  // servicio porque puede leer cualquier certificado.
  let urlCertificado: string | null = null;
  if (caso.archivo_pdf) {
    const { data: firmada } = await servicio
      .storage.from("certificados")
      .createSignedUrl(caso.archivo_pdf, 3600);
    urlCertificado = firmada?.signedUrl ?? null;
  }

  // PDF del plan de estudios de la carrera destino (lo que el admin cargó en /carreras). El bucket
  // 'planes' es público, así que basta su URL directa. Sirve para comparar el certificado del
  // estudiante contra el plan oficial de la Autónoma sin salir de la revisión.
  let urlPlan: string | null = null;
  if (caso.pensum?.archivo_pdf) {
    const { data: publica } = servicio.storage.from("planes").getPublicUrl(caso.pensum.archivo_pdf);
    urlPlan = publica.publicUrl;
  }

  // Documentos adicionales que adjuntó el estudiante (contenidos programáticos). URLs firmadas (1 h)
  // porque viven en el bucket privado `certificados`.
  const { data: docsData } = await servicio
    .from("documento_caso")
    .select("id, nombre_archivo, ruta")
    .eq("caso_id", params.id)
    .order("creado_en");
  const documentos = await Promise.all(
    ((docsData ?? []) as { id: string; nombre_archivo: string; ruta: string }[]).map(async (d) => {
      const { data: firmada } = await servicio.storage
        .from("certificados")
        .createSignedUrl(d.ruta, 3600);
      return { id: d.id, nombre: d.nombre_archivo, url: firmada?.signedUrl ?? null };
    }),
  );

  // Homologaciones aprobadas con sus nombres (para el resumen del caso cerrado).
  const nombreMateria = new Map(materias.map((m) => [m.id, m.nombre] as const));
  const nombreAsignatura = new Map(asignaturas.map((a) => [a.id, a.nombre] as const));
  const homologaciones = vinculos
    .filter((v) => v.estado === "aprobado")
    .map((v) => ({
      materia: nombreMateria.get(v.materiaOrigenId) ?? "—",
      asignatura: nombreAsignatura.get(v.asignaturaId) ?? "—",
    }));

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-dvh flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 shrink-0">
        <Link href="/casos" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
            {cerrado ? "Resumen de homologación" : "Estudio de homologación"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
            {caso.institucion_origen_nombre}
            <ArrowRight className="inline w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            {caso.pensum?.carrera ?? "—"}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${uiCaso.clases}`}
        >
          {uiCaso.etiqueta}
        </span>
      </header>

      {/* Datos de contacto del solicitante: con esto el admin lo ubica (correo/celular) para
          confirmarle la homologación. Solo aparece en casos que ya traen contacto (mig 0009). */}
      {(caso.solicitante_nombre || caso.solicitante_correo || caso.solicitante_celular) && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm shrink-0">
          {caso.solicitante_nombre && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              {caso.solicitante_nombre}
            </span>
          )}
          {caso.solicitante_correo && (
            <a
              href={`mailto:${caso.solicitante_correo}`}
              className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300 hover:text-blue-900 hover:underline"
            >
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              {caso.solicitante_correo}
            </a>
          )}
          {caso.solicitante_celular && (
            <a
              href={`tel:${caso.solicitante_celular.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              {caso.solicitante_celular}
            </a>
          )}
          {caso.solicitante_celular && (
            <a
              href={urlWhatsApp(
                caso.solicitante_celular,
                `Hola ${caso.solicitante_nombre ?? ""}, te escribimos de ${cfg.nombre} sobre tu solicitud de homologación para ${caso.pensum?.carrera ?? "tu carrera"}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-300 hover:text-green-800"
            >
              <Whatsapp className="w-4 h-4" />
              WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Documentos adicionales que adjuntó el estudiante (contenidos programáticos / syllabi). */}
      {documentos.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-2 text-sm shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mr-1">
            Adjuntos
          </span>
          {documentos.map(
            (d) =>
              d.url && (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300 hover:bg-blue-50 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 max-w-[220px]"
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{d.nombre}</span>
                </a>
              ),
          )}
        </div>
      )}

      {cerrado ? (
        <ResumenCaso
          caso={{
            id: caso.id,
            institucion: caso.institucion_origen_nombre,
            carrera: caso.pensum?.carrera ?? "—",
            estado: caso.estado as "aprobado" | "rechazado",
            semestre: caso.semestre_sugerido,
            notaAdmin: caso.nota_admin,
            notaInterna: caso.nota_interna,
            decididoEn: caso.decidido_en,
            decididoPor: caso.decididoPor?.nombre ?? null,
          }}
          homologaciones={homologaciones}
          urlCertificado={urlCertificado}
          urlPlan={urlPlan}
          plantillas={plantillas}
        />
      ) : (
        <EstudioHomologacion
          caso={{
            id: caso.id,
            institucion: caso.institucion_origen_nombre,
            carrera: caso.pensum?.carrera ?? "—",
            semestreSugerido: caso.semestre_sugerido,
            notaAdmin: caso.nota_admin,
            notaInterna: caso.nota_interna,
            cerrado,
          }}
          materias={materias}
          asignaturas={asignaturas}
          vinculos={vinculos}
          urlCertificado={urlCertificado}
          urlPlan={urlPlan}
          notaMinima={cfg.notaMinima}
          plantillas={plantillas}
        />
      )}
    </div>
  );
}
