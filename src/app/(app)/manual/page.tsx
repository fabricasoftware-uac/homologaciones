"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconBook2,
  IconSchool,
  IconBuildingBank,
  IconSettings,
  IconUser,
  IconArrowRight,
  IconCheck,
  IconSparkles,
  IconFileText,
  IconDownload,
  IconShieldCheck,
  IconExternalLink,
  IconHelpCircle,
  IconChevronRight,
  IconFileSpreadsheet,
  IconUsers,
  IconAdjustments,
  IconId,
  IconRotate,
} from "@tabler/icons-react";
import clsx from "clsx";

import { EncabezadoPagina } from "@/components/encabezado";

type RolManual = "asesor" | "verificador" | "admin" | "estudiante";

interface PasoGuia {
  numero: string;
  titulo: string;
  subtitulo?: string;
  descripcion: string;
  detalles: string[];
  enlace?: { texto: string; url: string };
  badge?: string;
}

interface ManualRol {
  id: RolManual;
  nombre: string;
  etiquetaCorta: string;
  icono: typeof IconSchool;
  descripcion: string;
  acento: "blue" | "emerald" | "violet" | "amber";
  pasos: PasoGuia[];
  consejoInstitucional: string;
}

const MANUALES: ManualRol[] = [
  {
    id: "asesor",
    nombre: "Coordinador de Programa (Asesor)",
    etiquetaCorta: "Coordinación",
    icono: IconSchool,
    descripcion:
      "Responsable académico de recibir el expediente, analizar las equivalencias asistidas por la IA, configurar las materias a matricular y emitir el veredicto oficial.",
    acento: "blue",
    consejoInstitucional:
      "La IA sugiere coincidencias semánticas basadas en los Resultados de Aprendizaje (RAs); verifica siempre que los créditos de origen cumplan con la intensidad horaria antes de confirmar el veredicto.",
    pasos: [
      {
        numero: "Paso 01",
        titulo: "Radicación de Nuevo Caso",
        subtitulo: "Ingreso de datos del aspirante y certificado de notas",
        descripcion:
          "Crea el expediente académico en el sistema ingresando los datos personales del solicitante y adjuntando su certificado oficial de calificaciones en formato PDF.",
        detalles: [
          "Diligencia nombre completo, cédula de ciudadanía, lugar de expedición, correo y celular de contacto.",
          "Selecciona la institución y programa de procedencia junto con el programa de destino en la institución.",
          "Carga el certificado oficial en PDF; el motor de OCR e Inteligencia Artificial extraerá automáticamente todas las materias cursadas con sus notas y créditos.",
        ],
        enlace: { texto: "Radicar nuevo caso", url: "/casos/nuevo" },
        badge: "Extracción Automática",
      },
      {
        numero: "Paso 02",
        titulo: "Estudio Asistido por IA y Navegación Secuencial",
        subtitulo: "Revisión interactiva y correspondencia materia por materia",
        descripcion:
          "Compara cada materia de procedencia contra la malla curricular de destino utilizando la barra de navegación secuencial y las herramientas de correspondencia.",
        detalles: [
          "Utiliza la barra de navegación secuencial [◀ Anterior] y [Siguiente ▶] para recorrer sistemáticamente cada materia sin perder el progreso.",
          "Haz clic en [🎯 Ir a Asignatura] para resaltar al instante la materia sugerida en la columna del plan de estudios de destino.",
          "Filtra rápidamente por semestres con los chips de acceso rápido o aprueba sugerencias de alta confianza (> 85%) en lote.",
        ],
        enlace: { texto: "Ir a la bandeja de casos", url: "/casos" },
        badge: "Similitud Semántica",
      },
      {
        numero: "Paso 03",
        titulo: "Proyección y Ajuste de Cursos a Matricular (Art. 3°)",
        subtitulo: "Configuración del bloque sugerido de 5 a 6 asignaturas",
        descripcion:
          "El sistema proyecta de forma inteligente los cursos que el estudiante debe cursar en su primer período según el Artículo 3° de la Resolución.",
        detalles: [
          "Priorización automática obligatoria: 1° Asignaturas rezagadas de semestres anteriores, 2° Asignaturas del semestre de ingreso y 3° Asignaturas de semestres posteriores hasta completar 5 o 6 materias.",
          "Reordena libremente las materias usando los controles de subida y bajada [▲ / ▼] o elimina materias no pertinentes.",
          "Agrega asignaturas adicionales del pensum con el selector agrupado por semestre o restablece la sugerencia con un solo clic.",
        ],
        badge: "Artículo 3° Oficial",
      },
      {
        numero: "Paso 04",
        titulo: "Aprobación y Confirmación del Semestre",
        subtitulo: "Modal de resumen y cierre de la revisión",
        descripcion:
          "Revisa el consolidado final de materias homologadas y el semestre de ubicación sugerido antes de sellar el estudio.",
        detalles: [
          "Verifica en el modal de confirmación la cantidad de materias aprobadas y el semestre sugerido calculado por créditos homologados.",
          "Agrega notas administrativas o recomendaciones curriculares para el estudiante.",
          "Confirma el cierre: el caso pasa a estado Aprobado y queda listo para la emisión de la Resolución en Vicerrectoría.",
        ],
        badge: "Cierre de Caso",
      },
    ],
  },
  {
    id: "verificador",
    nombre: "Vicerrectoría Académica / Verificador",
    etiquetaCorta: "Vicerrectoría",
    icono: IconBuildingBank,
    descripcion:
      "Encargado de la validación legal, asignación del consecutivo oficial del acto administrativo, seguimiento de matrícula y emisión de la Resolución.",
    acento: "emerald",
    consejoInstitucional:
      "Toda Resolución expedida cuenta con numeración legal y código QR de verificación que garantiza la autenticidad del acto administrativo ante el Ministerio de Educación Nacional.",
    pasos: [
      {
        numero: "Paso 01",
        titulo: "Filtro de Casos Aprobados",
        subtitulo: "Acceso prioritario en la bandeja central",
        descripcion:
          "Ingresa a la bandeja de casos y utiliza la pestaña de 'Aprobados' o el buscador por cédula y nombre para localizar los expedientes listos para expedición.",
        detalles: [
          "Filtra los casos decididos por coordinación académica pendientes de legalización.",
          "Consulta el detalle de materias homologadas, créditos equivalentes y plan curricular de destino.",
        ],
        enlace: { texto: "Ver casos aprobados", url: "/casos?estado=aprobado" },
        badge: "Bandeja Oficial",
      },
      {
        numero: "Paso 02",
        titulo: "Asignación del Consecutivo Oficial",
        subtitulo: "Registro del N.° de Resolución y parámetros de calendario",
        descripcion:
          "En la sección de Parámetros de la Resolución, digita el número correlativo oficial del libro de resoluciones de la institución.",
        detalles: [
          "Ingresa el N.° de Resolución asignado (ejemplo: 042, 105, etc.).",
          "Especifica el período académico de ingreso (ejemplo: 1P-2026) y la fecha límite de pago de matrícula según el calendario académico.",
          "Guarda los parámetros para que queden incorporados en el encabezado y articulado legal del documento.",
        ],
        badge: "Libro Radicador",
      },
      {
        numero: "Paso 03",
        titulo: "Seguimiento del Estado de Matrícula",
        subtitulo: "Checklist de asignaturas y verificación de pago",
        descripcion:
          "Monitorea el cumplimiento de requisitos del aspirante y verifica la inscripción efectiva de los cursos del Artículo 3°.",
        detalles: [
          "Controla el estado de inscripción (Pendiente, En trámite, Matriculado).",
          "Añade observaciones de verificación o alertas para el equipo de admisiones y registro académico.",
        ],
        badge: "Auditoría de Matrícula",
      },
      {
        numero: "Paso 04",
        titulo: "Generación y Descarga de la Resolución en PDF",
        subtitulo: "Acto administrativo con firmas, sellos y código QR",
        descripcion:
          "Descarga la Resolución Oficial lista para firma rectoral o notificación formal al aspirante.",
        detalles: [
          "Genera el PDF con las especificaciones de diseño institucional (escudo, vigilado MinEducación, tipografía reglamentaria y márgenes exactos).",
          "El documento contiene el Artículo 1° (materias homologadas con nota y créditos), Artículo 2° (foliado del expediente) y Artículo 3° (cursos a matricular).",
        ],
        badge: "PDF Oficial",
      },
    ],
  },
  {
    id: "admin",
    nombre: "Administrador del Sistema",
    etiquetaCorta: "Administración",
    icono: IconSettings,
    descripcion:
      "Control integral de la plataforma: gestión de usuarios y accesos, mallas curriculares de las carreras, identidad de marca institucional y métricas de gestión.",
    acento: "violet",
    consejoInstitucional:
      "Mantén actualizados los números de resolución MEN de cada plan de estudio en el módulo de Planes Académicos para que se citen automáticamente en las resoluciones.",
    pasos: [
      {
        numero: "Paso 01",
        titulo: "Gestión de Usuarios y Roles",
        subtitulo: "Control de accesos y perfiles de seguridad",
        descripcion:
          "Administra las cuentas de usuario y asigna los roles operativos del sistema (Administrador, Asesor/Coordinador, Verificador).",
        detalles: [
          "Crea nuevos usuarios del equipo académico y asigna permisos específicos según su función.",
          "Los coordinadores (asesores) gestionan sus programas; los verificadores visualizan y legalizan casos aprobados.",
        ],
        enlace: { texto: "Gestionar usuarios", url: "/usuarios" },
        badge: "Seguridad y Roles",
      },
      {
        numero: "Paso 02",
        titulo: "Planes Académicos y Mallas Curriculares",
        subtitulo: "Estructura de programas, materias y créditos",
        descripcion:
          "Configura los pensums oficiales de la institución que sirven como base para las equivalencias.",
        detalles: [
          "Carga planes de estudio en PDF y edita asignaturas, códigos, créditos e intensidades horarias.",
          "Configura la Resolución MEN correspondiente a cada carrera para su inclusión automática en los actos administrativos.",
        ],
        enlace: { texto: "Planes académicos", url: "/carreras" },
        badge: "Planes MEN",
      },
      {
        numero: "Paso 03",
        titulo: "Personalización de Marca y Parámetros",
        subtitulo: "Identidad institucional y reglas académicas",
        descripcion:
          "Ajusta los colores corporativos, logotipos, nota mínima de corte y nombre del coordinador de programa.",
        detalles: [
          "Personaliza los colores primario y de acento que visten toda la plataforma y los reportes.",
          "Establece la nota mínima aprobatoria para homologación (ejemplo: 3.0 sobre 5.0).",
          "Configura el nombre y cargo de la autoridad que refrenda las actas.",
        ],
        enlace: { texto: "Configuración institucional", url: "/configuracion" },
        badge: "Marca Institucional",
      },
      {
        numero: "Paso 04",
        titulo: "Métricas y Exportación de Reportes",
        subtitulo: "Consolidación de indicadores en Excel y CSV",
        descripcion:
          "Supervisa los volúmenes de solicitudes, tasas de aprobación por programa y tiempos de respuesta.",
        detalles: [
          "Visualiza gráficas interactivas de evolución temporal y distribución por estados.",
          "Exporta sábanas de datos completas a formato Excel (.xlsx con resumen ejecutivo) y CSV para analítica institucional.",
        ],
        enlace: { texto: "Ver reportes y métricas", url: "/reportes" },
        badge: "Reportes Excel",
      },
    ],
  },
  {
    id: "estudiante",
    nombre: "Aspirante / Estudiante",
    etiquetaCorta: "Aspirante",
    icono: IconUser,
    descripcion:
      "Portal de autoservicio para el aspirante: consulta pública del estado de su trámite, visualización de materias equivalentes y descarga del resultado final.",
    acento: "amber",
    consejoInstitucional:
      "El enlace de seguimiento es personal y seguro; consérvalo para consultar en tiempo real las decisiones tomadas por el comité de homologaciones.",
    pasos: [
      {
        numero: "Paso 01",
        titulo: "Seguimiento Seguro mediante Token",
        subtitulo: "Acceso directo sin necesidad de recordar contraseñas",
        descripcion:
          "El aspirante recibe un enlace único y confidencial tras la radicación de su solicitud para seguir el avance de su trámite.",
        detalles: [
          "Acceso inmediato a la vista pública de seguimiento (/seguimiento/[token]).",
          "Información transparente sobre la fase actual del caso: Procesando por IA, En revisión por coordinación o Decidido.",
        ],
        badge: "Token Único",
      },
      {
        numero: "Paso 02",
        titulo: "Consulta de Veredicto y Asignaturas",
        subtitulo: "Visualización de materias homologadas y semestre asignado",
        descripcion:
          "Una vez concluido el estudio, el aspirante conoce el detalle exacto de las equivalencias otorgadas.",
        detalles: [
          "Cuadro comparativo de materias de origen aprobadas y asignaturas equivalentes en la carrera.",
          "Semestre de ubicación sugerido para iniciar estudios.",
          "Cursos de matrícula recomendados para el primer período académico.",
        ],
        badge: "Transparencia Total",
      },
      {
        numero: "Paso 03",
        titulo: "Descarga de la Resolución Oficial",
        subtitulo: "Obtención del documento formal refrendado",
        descripcion:
          "Descarga directa del documento de homologación emitido por la institución educativa.",
        detalles: [
          "Documento oficial con validez legal para procesos de matrícula financiera y académica.",
          "Contiene código de verificación QR para corroborar autenticidad ante admisiones.",
        ],
        badge: "Resolución PDF",
      },
    ],
  },
];

export default function PaginaManual() {
  const [rolActivo, setRolActivo] = useState<RolManual>("asesor");

  const manualActual = MANUALES.find((m) => m.id === rolActivo) ?? MANUALES[0];
  const IconoRol = manualActual.icono;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <EncabezadoPagina
        titulo="Manuales de Usuario y Ayuda"
        descripcion="Guías oficiales de operación para cada rol en IrisLab."
        icono={IconBook2}
      />

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Selector de roles interactivo */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-1 pb-2">
            Selecciona tu rol para ver la guía correspondiente:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {MANUALES.map((manual) => {
              const activo = manual.id === rolActivo;
              const Icono = manual.icono;
              return (
                <button
                  key={manual.id}
                  type="button"
                  onClick={() => setRolActivo(manual.id)}
                  className={clsx(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-xs sm:text-sm font-semibold",
                    activo
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  <Icono
                    className={clsx(
                      "w-4 h-4 shrink-0",
                      activo
                        ? "text-blue-400 dark:text-blue-600"
                        : "text-slate-400 dark:text-slate-500",
                    )}
                  />
                  <span className="truncate">{manual.etiquetaCorta}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tarjeta de bienvenida al rol */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
              <IconoRol className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                <IconSparkles className="w-3.5 h-3.5" />
                Guía de Operación
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {manualActual.nombre}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {manualActual.descripcion}
              </p>
            </div>
          </div>

          {/* Consejo Institucional / Buenas Prácticas */}
          <div className="mt-5 p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
            <IconShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong className="font-semibold text-slate-900 dark:text-slate-100">Criterio Institucional: </strong>
              {manualActual.consejoInstitucional}
            </div>
          </div>
        </section>

        {/* Flujo paso a paso */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Flujo de Trabajo Operativo ({manualActual.pasos.length} Pasos)
            </h3>
            <span className="text-xs text-slate-400">IrisLab v1.0</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            {manualActual.pasos.map((paso, idx) => (
              <div
                key={paso.numero}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
                      {paso.numero}
                    </span>
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {paso.titulo}
                    </h4>
                  </div>
                  {paso.badge && (
                    <span className="self-start sm:self-auto text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                      {paso.badge}
                    </span>
                  )}
                </div>

                {paso.subtitulo && (
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">
                    {paso.subtitulo}
                  </p>
                )}

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                  {paso.descripcion}
                </p>

                {/* Lista de detalles clave */}
                <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Puntos clave del procedimiento:
                  </p>
                  <ul className="space-y-1.5">
                    {paso.detalles.map((detalle, dIdx) => (
                      <li
                        key={dIdx}
                        className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300"
                      >
                        <IconCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{detalle}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Acceso directo a la acción */}
                {paso.enlace && (
                  <div className="mt-4 pt-3 flex justify-end">
                    <Link
                      href={paso.enlace.url}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
                    >
                      {paso.enlace.texto}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Soporte y Atribución Institucional */}
        <section className="bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            ¿Requieres asistencia técnica o tienes dudas operativas?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contacta a la Coordinación Académica o al equipo de soporte de la plataforma.
          </p>
          <div className="pt-2 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800">
            Desarrollado por la <strong className="font-semibold text-slate-600 dark:text-slate-400">Fábrica de Software</strong> · Powered by <strong className="font-semibold text-slate-600 dark:text-slate-400">Emprendelab</strong>
          </div>
        </section>
      </main>
    </div>
  );
}
