"use client";

import { Children, useEffect, useState, useTransition } from "react";
import {
  IconChevronDown as ChevronDown,
  IconLink as LinkIcon,
  IconUnlink as Unlink,
  IconCheck as Check,
  IconX as X,
  IconSparkles as Sparkles,
  IconAlertTriangle as AlertTriangle,
  IconArrowRight as ArrowRight,
  IconArrowLeft as ArrowLeft,
  IconFileText as FileText,
  IconBook as BookOpen,
  IconSchool as GraduationCap,
  IconBuildingBank as Building,
  IconPlus as Plus,
  IconPencil as Pencil,
  IconChecks as Checks,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { sileo } from "sileo";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EstadoVinculo } from "@/types";
import {
  vincular,
  desvincular,
  finalizarCaso,
  confirmarSugerencias,
  agregarMateria,
  editarMateria,
  eliminarMateria,
} from "./acciones";
import { BotonReprocesar } from "./boton-reprocesar";
import { SelectorPlantilla } from "./selector-plantilla";

export type MateriaStudio = {
  id: string;
  codigo: string | null;
  nombre: string;
  creditos: number | null;
  intensidadHoraria: number | null;
  nota: string | null;
  semestre: number | null;
  tipo: string | null;
};
export type AsignaturaStudio = {
  id: string;
  codigo: string | null;
  nombre: string;
  creditos: number;
  semestre: number;
};
export type VinculoStudio = {
  id: string;
  materiaOrigenId: string;
  asignaturaId: string;
  similitud: number;
  razon: string | null;
  estado: EstadoVinculo;
};

type Props = {
  caso: {
    id: string;
    institucion: string;
    carrera: string;
    semestreSugerido: number | null;
    notaAdmin: string | null;
    notaInterna: string | null;
    cerrado: boolean;
  };
  materias: MateriaStudio[];
  asignaturas: AsignaturaStudio[];
  vinculos: VinculoStudio[];
  urlCertificado: string | null;
  urlPlan: string | null;
  notaMinima: number;
  plantillas: { id: string; texto: string }[];
};

// Color del badge de similitud: por debajo de 85% conviene que el admin lo revise con lupa (la IA
// puede haberse equivocado, p. ej. relacionar "Desarrollo" con "Inglés").
function colorSimilitud(similitud: number): string {
  if (similitud >= 85) return "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40";
  if (similitud >= 70) return "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40";
  return "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40";
}

// Umbral fijo de confianza para la confirmación en lote (las sugerencias "seguras" de la IA).
const UMBRAL_LOTE = 90;

// Convierte la nota de origen (texto libre) a número en escala 0–5 cuando se puede. Acepta coma o
// punto decimal; descarta lo que no sea numérico ("APROBADO", "A", vacío) devolviendo null. Si la
// nota viniera en escala 0–100, la baja a 0–5.
function parseNota(texto: string | null): number | null {
  if (!texto) return null;
  const limpio = texto.replace(",", ".").replace(/[^\d.]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return n > 5 && n <= 100 ? n / 20 : n;
}

function agrupar<T extends { semestre: number | null }>(items: T[]): [number, T[]][] {
  const mapa = new Map<number, T[]>();
  for (const item of items) {
    const clave = item.semestre ?? 0; // 0 = "Sin semestre"
    const lista = mapa.get(clave);
    if (lista) lista.push(item);
    else mapa.set(clave, [item]);
  }
  // Las materias sin semestre (clave 0) van al FINAL, no al principio.
  return Array.from(mapa.entries()).sort((a, b) => (a[0] || Infinity) - (b[0] || Infinity));
}

// Estudio de homologación: ORIGEN a la izquierda (lo que cursó el estudiante), DESTINO a la derecha
// (el plan de la Autónoma). El admin selecciona una materia de cada lado y las vincula a mano; así
// puede corregir lo que la IA sugirió.
export function EstudioHomologacion({
  caso,
  materias,
  asignaturas,
  vinculos,
  urlCertificado,
  urlPlan,
  notaMinima,
  plantillas,
}: Props) {
  const [pendiente, iniciar] = useTransition();
  // Selección de materias de origen. Normalmente UNA; con el modo "Seleccionar varias" activo se
  // pueden marcar 2+ para vincularlas JUNTAS a una misma asignatura destino (homologación N→1).
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [destino, setDestino] = useState<string | null>(null); // asignatura seleccionada
  const [columnaMovil, setColumnaMovil] = useState<"origen" | "destino">("origen"); // pestaña activa en móvil
  const [semestre, setSemestre] = useState(
    caso.semestreSugerido != null ? String(caso.semestreSugerido) : "",
  );
  const [nota, setNota] = useState(caso.notaAdmin ?? "");
  const [notaInterna, setNotaInterna] = useState(caso.notaInterna ?? "");
  // Editor de materias de origen: crear una que faltó o corregir/eliminar una extraída.
  const [editorMateria, setEditorMateria] = useState<
    { modo: "crear" } | { modo: "editar"; materia: MateriaStudio } | null
  >(null);

  const { cerrado } = caso;
  const vinculoDeMateria = (id: string) => vinculos.filter((v) => v.materiaOrigenId === id);
  const vinculosDeAsignatura = (id: string) => vinculos.filter((v) => v.asignaturaId === id);
  const aprobadas = vinculos.filter((v) => v.estado === "aprobado").length;
  const pct = materias.length > 0 ? Math.round((aprobadas / materias.length) * 100) : 0;
  const origen = origenes.length === 1 ? origenes[0] : null;
  const vinculosOrigen = origen ? vinculoDeMateria(origen) : [];
  const vinculoOrigen = vinculosOrigen[0] ?? null;
  const sugerenciaPendiente = vinculosOrigen.some((v) => v.estado !== "aprobado");

  // Para mostrar en cada tarjeta CON QUÉ está vinculada, sin tener que hacer clic.
  const asignaturaPorId = new Map(asignaturas.map((a) => [a.id, a] as const));
  const materiaPorId = new Map(materias.map((m) => [m.id, m] as const));

  // Materias de origen en orden alfabético. Como el agrupado por semestre conserva el orden de
  // entrada, cada semestre queda ordenado de la A a la Z. localeCompare "es" respeta tildes y la ñ.
  const materiasOrdenadas = [...materias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Al seleccionar una materia de origen que ya está vinculada, desplazamos la columna derecha
  // hasta su asignatura (puede estar muy abajo). Y al revés, al seleccionar una asignatura.
  useEffect(() => {
    if (!origen) return;
    const v = vinculos.find((x) => x.materiaOrigenId === origen);
    if (!v) return;
    document
      .getElementById(`card-asig-${v.asignaturaId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [origen, vinculos]);

  useEffect(() => {
    if (!destino) return;
    const v = vinculos.find((x) => x.asignaturaId === destino);
    if (!v) return;
    document
      .getElementById(`card-mat-${v.materiaOrigenId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [destino, vinculos]);

  function limpiar() {
    setOrigenes([]);
    setDestino(null);
  }

  // Clic en una materia de origen: en modo normal reemplaza la selección; en modo múltiple la
  // agrega/quita del grupo.
  function alternarOrigen(id: string) {
    setOrigenes((prev) => {
      if (multiple) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return prev.length === 1 && prev[0] === id ? [] : [id];
    });
  }

  function alternarMultiple() {
    setMultiple((activo) => {
      // Al apagar el modo, conservamos solo la primera seleccionada (volvemos al flujo simple).
      if (activo) setOrigenes((prev) => prev.slice(0, 1));
      return !activo;
    });
  }

  // Vincula TODAS las materias seleccionadas con la asignatura destino (1 o varias → 1). Si alguna
  // ya tenía vínculo, se re-vincula (mismo comportamiento del flujo simple).
  function hacerVincular() {
    if (origenes.length === 0 || !destino) return;
    const seleccionadas = [...origenes];
    iniciar(async () => {
      for (const materiaId of seleccionadas) {
        const existente = vinculoDeMateria(materiaId)[0];
        const fd = new FormData();
        fd.set("casoId", caso.id);
        fd.set("materiaOrigenId", materiaId);
        fd.set("asignaturaId", destino);
        fd.set("vinculoId", existente?.id ?? "");
        await vincular(fd);
      }
      sileo.success({
        title:
          seleccionadas.length > 1
            ? `${seleccionadas.length} materias vinculadas a la asignatura`
            : "Materias vinculadas",
      });
      limpiar();
    });
  }

  function hacerDesvincular() {
    const existente = origen ? vinculoDeMateria(origen)[0] : null;
    if (!existente) return;
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", caso.id);
      fd.set("vinculoId", existente.id);
      await desvincular(fd);
      sileo.success({ title: "Homologación quitada" });
      limpiar();
    });
  }

  // Aprueba de un clic TODAS las homologaciones pendientes sugeridas por la IA para la materia
  // seleccionada, sin que el admin tenga que elegir destino. Para SENA, una competencia puede tener
  // 2+ vínculos pendientes: se confirman todos juntos.
  function hacerConfirmar() {
    if (!origen || vinculosOrigen.length === 0) return;
    iniciar(async () => {
      for (const v of vinculosOrigen) {
        if (v.estado === "aprobado") continue;
        const fd = new FormData();
        fd.set("casoId", caso.id);
        fd.set("materiaOrigenId", origen);
        fd.set("asignaturaId", v.asignaturaId);
        fd.set("vinculoId", v.id);
        await vincular(fd);
      }
      const confirmadas = vinculosOrigen.filter((v) => v.estado !== "aprobado").length;
      sileo.success({
        title: confirmadas > 1 ? `${confirmadas} vinculaciones confirmadas` : "Vinculación confirmada",
      });
      limpiar();
    });
  }

  // Sugerencias de la IA aún pendientes que superan el umbral de confianza (candidatas a lote).
  const sugerenciasAltas = vinculos.filter(
    (v) => v.estado === "pendiente" && v.similitud >= UMBRAL_LOTE,
  ).length;

  function hacerConfirmarLote() {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", caso.id);
      fd.set("umbral", String(UMBRAL_LOTE));
      const { aprobadas } = await confirmarSugerencias(fd);
      sileo.success({
        title: aprobadas > 0 ? `${aprobadas} sugerencia(s) confirmada(s)` : "No había sugerencias por confirmar",
      });
      limpiar();
    });
  }

  // Guarda el editor de materias (crear o editar según el modo abierto).
  function guardarMateria(fd: FormData) {
    const editor = editorMateria;
    if (!editor) return;
    fd.set("casoId", caso.id);
    if (editor.modo === "editar") fd.set("materiaId", editor.materia.id);
    iniciar(async () => {
      const res = editor.modo === "editar" ? await editarMateria(fd) : await agregarMateria(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo guardar", description: res.error });
        return;
      }
      sileo.success({ title: editor.modo === "editar" ? "Materia actualizada" : "Materia agregada" });
      setEditorMateria(null);
      limpiar();
    });
  }

  function hacerEliminarMateria() {
    const editor = editorMateria;
    if (!editor || editor.modo !== "editar") return;
    const fd = new FormData();
    fd.set("casoId", caso.id);
    fd.set("materiaId", editor.materia.id);
    iniciar(async () => {
      const res = await eliminarMateria(fd);
      if (res?.error) {
        sileo.error({ title: "No se pudo eliminar", description: res.error });
        return;
      }
      sileo.warning({ title: "Materia eliminada", description: "Sus vínculos también se quitaron." });
      setEditorMateria(null);
      limpiar();
    });
  }

  function hacerFinalizar(veredicto: "aprobado" | "rechazado") {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", caso.id);
      fd.set("veredicto", veredicto);
      fd.set("semestre", semestre);
      fd.set("nota", nota);
      fd.set("notaInterna", notaInterna);
      await finalizarCaso(fd);
      sileo[veredicto === "aprobado" ? "success" : "warning"]({
        title: veredicto === "aprobado" ? "Caso aprobado" : "Caso rechazado",
      });
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Barra superior del estudio */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
        <div className="flex items-center gap-4 min-w-0 mr-auto">
          {/* Progreso: cuántas materias del estudiante ya quedaron homologadas (barra, más intuitivo). */}
          <div className="min-w-[140px] max-w-[240px] flex-1">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Materias homologadas</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {aprobadas} <span className="text-slate-400 dark:text-slate-500">de {materias.length}</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
          {/* Semestre que estimó la IA, a la vista durante la revisión (lo confirma el admin al final). */}
          {caso.semestreSugerido != null && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-marca bg-marca/10 border border-marca/20 dark:text-slate-200 dark:bg-white/5 dark:border-white/10 px-3 py-1.5 rounded-xl whitespace-nowrap">
              <GraduationCap className="w-4 h-4" />
              Semestre sugerido: {caso.semestreSugerido}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {urlCertificado && (
            <a
              href={urlCertificado}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Ver certificado</span>
            </a>
          )}
          {urlPlan ? (
            <a
              href={urlPlan}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Ver pensum</span>
            </a>
          ) : (
            // Esta carrera todavía no tiene el PDF del pensum cargado. Lo dejamos deshabilitado (no
            // navega a otra pantalla, para no perder el estudio); el admin lo sube en Planes Académicos.
            <span
              title="Esta carrera aún no tiene el pensum cargado. Súbelo en Planes Académicos."
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 cursor-not-allowed select-none"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Ver pensum</span>
            </span>
          )}
          {!cerrado && sugerenciasAltas > 0 && (
            <button
              onClick={hacerConfirmarLote}
              disabled={pendiente}
              title={`Aprueba las ${sugerenciasAltas} sugerencias de la IA con ${UMBRAL_LOTE}% o más`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              <span className="hidden sm:inline">Confirmar {sugerenciasAltas} ≥ {UMBRAL_LOTE}%</span>
            </button>
          )}
          {!cerrado && <BotonReprocesar casoId={caso.id} />}
          {!cerrado && (
          <Dialog>
            <DialogTrigger asChild>
              <button className="bg-marca text-marca-fg px-5 py-2 rounded-lg font-medium hover:bg-marca-hover dark:bg-marca-hover dark:hover:bg-marca text-sm shadow-sm">
                Finalizar revisión
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Finalizar revisión</DialogTitle>
                <DialogDescription>
                  Confirma el semestre en el que quedaría el estudiante y emite el veredicto del caso.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label htmlFor="sem-final" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Semestre
                  </label>
                  {caso.semestreSugerido != null && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      Recomendación de la IA: semestre {caso.semestreSugerido}
                    </p>
                  )}
                  <input
                    id="sem-final"
                    type="number"
                    min={1}
                    value={semestre}
                    onChange={(e) => setSemestre(e.target.value)}
                    className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="nota-final" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Nota para el estudiante{" "}
                      <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <SelectorPlantilla
                      plantillas={plantillas}
                      onInsertar={(t) => setNota((prev) => (prev.trim() ? `${prev}\n${t}` : t))}
                    />
                  </div>
                  <textarea
                    id="nota-final"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={3}
                    placeholder="Ej.: Debes presentar los programas de las materias homologadas en admisiones."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none text-sm"
                  />
                </div>
                <div>
                  {/* "Interna" se señala con el punto ámbar del label, no tiñendo el input entero:
                      el campo queda neutro como los demás (el tinte ámbar completo se veía mal,
                      sobre todo en oscuro). */}
                  <label htmlFor="nota-interna" className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    Nota interna{" "}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">(no la ve el estudiante)</span>
                  </label>
                  <textarea
                    id="nota-interna"
                    value={notaInterna}
                    onChange={(e) => setNotaInterna(e.target.value)}
                    rows={2}
                    placeholder="Ej.: Falta confirmar créditos de Cálculo II con el coordinador."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                {/* Veredicto con la paleta semántica del estudio: rechazar = rose (outline, acción
                    secundaria), aprobar = emerald sólido (acción principal). Antes: rojo con hover
                    claro sin variante dark (se "encendía" en modo oscuro) y aprobar en color de
                    marca, que no comunicaba veredicto. */}
                <button
                  onClick={() => hacerFinalizar("rechazado")}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                >
                  Rechazar caso
                </button>
                <button
                  onClick={() => hacerFinalizar("aprobado")}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                >
                  Aprobar caso
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Pestañas Origen/Destino: solo en móvil. En escritorio se ven las dos columnas a la vez. */}
      <div className="md:hidden flex shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {(
          [
            ["origen", "Origen"],
            ["destino", "Destino"],
          ] as const
        ).map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setColumnaMovil(clave)}
            className={clsx(
              "flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              columnaMovil === clave
                ? "border-marca text-marca"
                : "border-transparent text-slate-500 dark:text-slate-400",
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* Dos columnas (escritorio) / una a la vez según la pestaña (móvil) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:min-h-0 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto md:overflow-hidden">
        <Columna
          etiqueta="Origen · materias del estudiante"
          titulo={caso.institucion}
          icono={Building}
          iconoClase="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          acento="text-slate-400 dark:text-slate-500"
          claseRaiz={columnaMovil === "origen" ? "flex md:flex" : "hidden md:flex"}
        >
          {/* Herramientas de la columna origen: alta manual + modo de selección múltiple (para
              vincular VARIAS materias a una sola asignatura de un tiro). */}
          {!cerrado && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditorMateria({ modo: "crear" })}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 hover:border-sky-400 dark:hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar materia
              </button>
              <button
                type="button"
                onClick={alternarMultiple}
                title="Marca varias materias y vincúlalas juntas a una misma asignatura"
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl px-3 py-2.5 border-2 transition-colors",
                  multiple
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : "border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-sky-400 dark:hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400",
                )}
              >
                <Checks className="w-4 h-4" />
                {multiple ? "Selección múltiple: activa" : "Seleccionar varias"}
              </button>
            </div>
          )}
          {agrupar(materiasOrdenadas).map(([sem, items]) => (
            <GrupoSemestre key={`o-${sem}`} sem={sem}>
              {items.map((m) => {
                const vinculosMateria = vinculoDeMateria(m.id);
                const seleccionada = origenes.includes(m.id);
                const destinos = vinculosMateria
                  .map((v) => asignaturaPorId.get(v.asignaturaId))
                  .filter((d): d is NonNullable<typeof d> => d != null);
                const estados = vinculosMateria.map((v) => v.estado);
                const estadoAgregado: EstadoVinculo | null =
                  estados.length === 0 ? null
                  : estados.every((e) => e === "aprobado") ? "aprobado"
                  : estados.some((e) => e === "pendiente") ? "pendiente"
                  : "pendiente";

                const dest = destinos[0] ?? null;
                const todasAprobadas = estados.length > 0 && estados.every((e) => e === "aprobado");
                // Avisos académicos: nota por debajo del mínimo, o destino con más créditos que el
                // origen (se estaría homologando una materia "más pesada" con una más liviana).
                const notaNum = parseNota(m.nota);
                const avisos: string[] = [];
                if (notaNum != null && notaNum < notaMinima) {
                  avisos.push(`Nota ${notaNum} (mín. ${notaMinima})`);
                }
                if (destinos.length === 1 && dest && m.creditos != null && dest.creditos > m.creditos) {
                  avisos.push(`Créditos ${m.creditos}→${dest.creditos}`);
                }
                const primerVinculo = vinculosMateria[0];
                return (
                  <Tarjeta
                    key={m.id}
                    idElemento={`card-mat-${m.id}`}
                    codigo={m.codigo}
                    nombre={m.nombre}
                    creditos={m.creditos}
                    intensidadHoraria={m.intensidadHoraria}
                    nota={m.nota}
                    alerta={avisos.length > 0 ? avisos.join(" · ") : undefined}
                    similitud={primerVinculo?.similitud}
                    razon={primerVinculo?.razon ?? undefined}
                    estado={estadoAgregado}
                    vinculadoCon={
                      destinos.length > 0
                        ? { nombres: destinos.map((d) => d.nombre), aprobado: todasAprobadas }
                        : undefined
                    }
                    seleccionada={seleccionada}
                    resaltada={
                      destinos.length > 0 && destino != null
                        ? vinculosMateria.some((v) => v.asignaturaId === destino)
                        : false
                    }
                    tipo="origen"
                    onClick={cerrado ? undefined : () => alternarOrigen(m.id)}
                    onEditar={cerrado ? undefined : () => setEditorMateria({ modo: "editar", materia: m })}
                  />
                );
              })}
            </GrupoSemestre>
          ))}
          {materias.length === 0 && <Vacio>No se detectaron materias.</Vacio>}
        </Columna>

        <Columna
          etiqueta="Destino · plan de la Autónoma"
          titulo={caso.carrera}
          icono={GraduationCap}
          iconoClase="bg-marca/10 text-marca dark:bg-white/10 dark:text-slate-100"
          acento="text-marca dark:text-slate-300"
          fondo="bg-slate-50/40 dark:bg-slate-900/40"
          claseRaiz={columnaMovil === "destino" ? "flex md:flex" : "hidden md:flex"}
        >
          {agrupar(asignaturas).map(([sem, items]) => (
            <GrupoSemestre key={`d-${sem}`} sem={sem}>
              {items.map((a) => {
                // Una asignatura puede recibir VARIAS materias de origen (homologación 2→1):
                // el estado y el pie de la tarjeta reflejan el conjunto, no solo la primera.
                const vs = vinculosDeAsignatura(a.id);
                const seleccionada = destino === a.id;
                const aprobada = vs.some((v) => v.estado === "aprobado");
                const pendiente = vs.find((v) => v.estado === "pendiente");
                const nombresOrigen = vs
                  .map((v) => materiaPorId.get(v.materiaOrigenId)?.nombre)
                  .filter((n): n is string => !!n);
                return (
                  <Tarjeta
                    key={a.id}
                    idElemento={`card-asig-${a.id}`}
                    codigo={a.codigo}
                    nombre={a.nombre}
                    creditos={a.creditos}
                    nota={null}
                    similitud={!aprobada && pendiente ? pendiente.similitud : undefined}
                    razon={pendiente?.razon ?? undefined}
                    vinculada={aprobada}
                    estado={aprobada ? "aprobado" : pendiente ? "pendiente" : null}
                    vinculadoCon={
                      nombresOrigen.length > 0
                        ? { nombres: nombresOrigen, aprobado: aprobada }
                        : undefined
                    }
                    seleccionada={seleccionada}
                    resaltada={origen != null && vs.some((v) => v.materiaOrigenId === origen)}
                    tipo="destino"
                    onClick={cerrado ? undefined : () => setDestino(seleccionada ? null : a.id)}
                  />
                );
              })}
            </GrupoSemestre>
          ))}
          {asignaturas.length === 0 && <Vacio>Esta carrera no tiene plan cargado aún.</Vacio>}
        </Columna>
      </div>

      {/* Barra flotante de vinculación */}
      <AnimatePresence>
        {!cerrado && origenes.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="absolute bottom-4 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 z-40 border border-white/10"
          >
            <div className="text-center md:text-left min-w-0">
              <span className="text-sm font-medium block">
                {destino
                  ? origenes.length > 1
                    ? `Vincular las ${origenes.length} materias con la asignatura`
                    : "Vincular la materia con la asignatura"
                  : origenes.length > 1
                    ? `${origenes.length} materias seleccionadas · elige la asignatura destino`
                    : sugerenciaPendiente
                      ? vinculosOrigen.length > 1
                        ? `La IA sugirió ${vinculosOrigen.length} homologaciones`
                        : "La IA sugirió esta homologación"
                      : vinculoOrigen
                        ? vinculosOrigen.length > 1
                          ? `${vinculosOrigen.length} materias homologadas`
                          : "Materia ya homologada"
                        : "Elige una asignatura destino"}
              </span>
              {!destino && sugerenciaPendiente && vinculoOrigen?.razon && (
                <span className="text-xs text-slate-400 block mt-0.5 max-w-md">
                  {vinculosOrigen.length > 1
                    ? `${vinculosOrigen.length} vínculos pendientes por confirmar`
                    : vinculoOrigen.razon}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
              {destino ? (
                <button
                  onClick={hacerVincular}
                  disabled={pendiente}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-1.5 rounded-xl font-bold text-sm"
                >
                  <LinkIcon className="w-4 h-4" />
                  {origenes.length > 1 ? `Vincular ${origenes.length} materias` : "Vincular"}
                </button>
              ) : (
                <>
                  {/* Sugerencia de la IA sin confirmar: el admin la aprueba de un clic (sin elegir el
                      destino a mano). El botón de desvincular sigue ahí por si prefiere descartarla. */}
                  {sugerenciaPendiente && (
                    <button
                      onClick={hacerConfirmar}
                      disabled={pendiente}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-1.5 rounded-xl font-bold text-sm"
                    >
                      <Check className="w-4 h-4" strokeWidth={3} /> Confirmar vinculación
                    </button>
                  )}
                  {vinculoOrigen && (
                    <button
                      onClick={hacerDesvincular}
                      disabled={pendiente}
                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-1.5 rounded-xl font-bold text-sm"
                    >
                      <Unlink className="w-4 h-4" /> Desvincular
                    </button>
                  )}
                </>
              )}
              <button onClick={limpiar} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor de materias de origen: agregar una que faltó o corregir/eliminar una extraída. La
          key reinicia los inputs (defaultValue) al cambiar de materia o de modo. */}
      <Dialog open={editorMateria !== null} onOpenChange={(abierto) => !abierto && setEditorMateria(null)}>
        <DialogContent key={editorMateria?.modo === "editar" ? editorMateria.materia.id : "crear"}>
          <DialogHeader>
            <DialogTitle>
              {editorMateria?.modo === "editar" ? "Editar materia" : "Agregar materia"}
            </DialogTitle>
            <DialogDescription>
              {editorMateria?.modo === "editar"
                ? "Corrige lo que la extracción automática no leyó bien. Sus vínculos se conservan."
                : "Agrega una materia del certificado que la extracción no detectó."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardarMateria(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="mat-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Nombre
              </label>
              <input
                id="mat-nombre"
                name="nombre"
                type="text"
                required
                defaultValue={editorMateria?.modo === "editar" ? editorMateria.materia.nombre : ""}
                placeholder="Ej.: Cálculo Diferencial"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="mat-creditos" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Créditos
                </label>
                <input
                  id="mat-creditos"
                  name="creditos"
                  type="number"
                  min={1}
                  defaultValue={editorMateria?.modo === "editar" ? editorMateria.materia.creditos ?? "" : ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="mat-semestre" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Semestre
                </label>
                <input
                  id="mat-semestre"
                  name="semestre"
                  type="number"
                  min={1}
                  defaultValue={editorMateria?.modo === "editar" ? editorMateria.materia.semestre ?? "" : ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="mat-nota" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Nota
                </label>
                <input
                  id="mat-nota"
                  name="nota"
                  type="text"
                  defaultValue={editorMateria?.modo === "editar" ? editorMateria.materia.nota ?? "" : ""}
                  placeholder="Ej.: 4.2"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              {editorMateria?.modo === "editar" && (
                <button
                  type="button"
                  onClick={hacerEliminarMateria}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                >
                  Eliminar
                </button>
              )}
              <button
                type="submit"
                disabled={pendiente}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {editorMateria?.modo === "editar" ? "Guardar cambios" : "Agregar materia"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Columna({
  etiqueta,
  titulo,
  icono: Icono,
  iconoClase,
  acento,
  fondo,
  claseRaiz,
  children,
}: {
  etiqueta: string;
  titulo: string;
  icono: React.ComponentType<{ className?: string }>;
  iconoClase: string;
  acento: string;
  fondo?: string;
  claseRaiz?: string;
  children: React.ReactNode;
}) {
  return (
    // claseRaiz controla el display: en móvil oculta/muestra según la pestaña; en escritorio siempre flex.
    <div className={clsx("flex-col md:min-h-0", fondo, claseRaiz ?? "flex")}>
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-3">
        <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconoClase)}>
          <Icono className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <p className={clsx("text-[11px] font-bold uppercase tracking-wider mb-0.5", acento)}>
            {etiqueta}
          </p>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-none">{titulo}</h2>
        </div>
      </div>
      <div className="flex-1 md:overflow-y-auto p-5 space-y-6">{children}</div>
    </div>
  );
}

function GrupoSemestre({ sem, children }: { sem: number; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(true);
  const cantidad = Children.count(children);
  return (
    <div>
      {/* Encabezado del semestre como etiqueta liviana (sin caja anidada): se siente más aireado. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors group"
      >
        <ChevronDown
          className={clsx("w-3.5 h-3.5 transition-transform duration-200", !abierto && "-rotate-90")}
        />
        <span>{sem === 0 ? "Sin semestre" : `Semestre ${sem}`}</span>
        <span className="font-semibold normal-case text-slate-300 dark:text-slate-600">{cantidad}</span>
        <span className="flex-1 border-b border-slate-100 dark:border-slate-800 ml-1" />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* px-2/pt-3/pb-2: dejan aire para que el anillo de selección (ring-2) y la insignia
                flotante "Enlazada" (que sobresale -10px arriba / -8px a la derecha de la tarjeta)
                NO se corten con el overflow-hidden de la animación de despliegue. */}
            <div className="space-y-2.5 px-2 pt-3 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tarjeta({
  idElemento,
  codigo,
  nombre,
  creditos,
  intensidadHoraria,
  nota,
  similitud,
  razon,
  alerta,
  vinculada,
  estado,
  vinculadoCon,
  seleccionada,
  resaltada,
  tipo,
  onClick,
  onEditar,
}: {
  idElemento: string;
  codigo: string | null;
  nombre: string;
  creditos: number | null;
  intensidadHoraria?: number | null;
  nota: string | null;
  similitud?: number;
  razon?: string;
  alerta?: string;
  vinculada?: boolean;
  estado: EstadoVinculo | null;
  // Con qué está enlazada esta tarjeta: puede ser MÁS de una (dos materias de origen que juntas
  // homologan una asignatura destino).
  vinculadoCon?: { nombres: string[]; aprobado: boolean };
  seleccionada: boolean;
  resaltada: boolean;
  tipo: "origen" | "destino";
  onClick?: () => void;
  // Edición manual (solo materias de origen): abre el editor sin disparar la selección.
  onEditar?: () => void;
}) {
  // Principio de diseño: la SUPERFICIE de la tarjeta es SIEMPRE neutra (blanco / superficie del tema
  // oscuro elegido), y el color solo SEÑALA, no inunda. El estado del vínculo va en una barra de
  // acento sólida a la izquierda (ámbar = sugerencia IA pendiente, verde = aprobada) + insignias; un
  // acento fino y sólido se lee sobre cualquier tema sin pelear con su paleta, mientras que teñir toda
  // la tarjeta (lo anterior) se veía distinto —y a veces mal— en cada tema. La barra existe siempre
  // (transparente si no hay vínculo) para que todas las tarjetas alineen igual.
  const claseEstado =
    estado === "aprobado"
      ? "border-l-emerald-500"
      : estado === "pendiente"
        ? "border-l-amber-400 dark:border-l-amber-500"
        : "border-l-transparent";

  // Superficie: neutra por defecto (se adapta a la paleta del tema). Cuando la tarjeta participa del
  // PAR ACTIVO (la seleccionada o su contraparte enlazada), se tiñe de sky suave: como es un estado
  // TEMPORAL de interacción —no decoración permanente— el tinte no ensucia ningún tema y hace que el
  // enlace se lea como un todo, no solo por el borde.
  const parActivo = seleccionada || resaltada;
  const claseSuperficie = parActivo
    ? "bg-sky-50 dark:bg-sky-500/10"
    : "bg-white dark:bg-slate-900";

  // El PAR ACTIVO lleva el MISMO anillo sky sólido en ambas tarjetas (mismo color = misma relación;
  // sky es distinto de los colores de estado y de marca, y brilla sobre los temas oscuros). La
  // seleccionada se distingue por la sombra más fuerte y su etiqueta; la contraparte, por la insignia
  // flotante "Enlazada" (abajo).
  const claseSeleccion = seleccionada
    ? "ring-2 ring-sky-500 dark:ring-sky-400 shadow-lg shadow-sky-500/20"
    : resaltada
      ? "ring-2 ring-sky-500 dark:ring-sky-400 shadow-md shadow-sky-500/10"
      : "";

  return (
    <motion.div
      id={idElemento}
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      className={clsx(
        // Superficie neutra que se adapta al tema; barra de acento izquierda (border-l-4) + anillo.
        // relative: ancla la insignia flotante "Enlazada" de la contraparte del par activo.
        "relative scroll-mt-4 rounded-xl border border-l-4 p-3.5 transition-all select-none",
        "border-slate-200 dark:border-slate-800",
        claseSuperficie,
        claseEstado,
        claseSeleccion,
        // El hover NO toca el borde (pisaría el color de la barra izquierda por especificidad de
        // :hover): la elevación la dan la sombra y el whileHover de motion.
        onClick && "cursor-pointer hover:shadow-md dark:hover:shadow-black/30",
      )}
    >
      {/* Insignia flotante sobre la CONTRAPARTE del par activo: el anillo solo no alcanzaba para
          ubicar de un vistazo con quién se enlaza la selección. Aparece con un "pop" (el movimiento
          es la señal que más atrae el ojo) y usa sky sólido, legible sobre cualquier tema. */}
      {resaltada && (
        <motion.span
          initial={{ scale: 0.5, opacity: 0, y: 4 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className="absolute -top-2.5 -right-2 z-10 flex items-center gap-1 bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-sky-500/40 pointer-events-none"
        >
          <LinkIcon className="w-3 h-3" /> Enlazada
        </motion.span>
      )}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[18px]">
        {codigo ? (
          <span className="text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {codigo}
          </span>
        ) : (
          <span />
        )}
        {similitud != null && (
          <span
            title={razon ?? undefined}
            className={clsx(
              "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
              colorSimilitud(similitud),
            )}
          >
            <Sparkles className="w-3 h-3" />
            {similitud}% IA
          </span>
        )}
        {vinculada && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 px-2 py-0.5 rounded-full">
            <LinkIcon className="w-3 h-3" /> Vinculado
          </span>
        )}
        {onEditar && (
          <button
            type="button"
            title="Editar materia"
            onClick={(e) => {
              e.stopPropagation(); // que el lápiz no dispare la selección de la tarjeta
              onEditar();
            }}
            className="p-1 -m-1 rounded text-slate-300 dark:text-slate-600 hover:text-sky-600 dark:hover:text-sky-400 transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* El nombre es SIEMPRE neutro: qué columna es ya lo dice el encabezado de la columna. Antes el
          destino iba en azul fijo, que chocaba con el color de marca y con los temas oscuros azulados. */}
      <h3 className="font-bold text-sm leading-snug text-slate-800 dark:text-slate-100">{nombre}</h3>
      <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {creditos != null && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{creditos} CR</span>}
        {intensidadHoraria != null && (
          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]" title="Intensidad horaria original del SENA">
            {intensidadHoraria}h
          </span>
        )}
        {nota && (
          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-auto">
            Nota {nota}
          </span>
        )}
        {seleccionada && (
          <span className="ml-auto flex items-center gap-1 text-sky-600 dark:text-sky-400">
            <Check className="w-3.5 h-3.5" strokeWidth={3} /> Seleccionada
          </span>
        )}
      </div>

      {/* Aviso académico (nota baja o créditos): que el admin lo revise con cuidado. */}
      {alerta && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md px-2 py-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">{alerta}</span>
        </div>
      )}

      {/* Con qué está homologada esta materia (visible sin hacer clic). */}
      {vinculadoCon && (
        <div
          className={clsx(
            "mt-2.5 pt-2.5 border-t flex items-center gap-1.5 text-[11px] font-semibold",
            vinculadoCon.aprobado
              ? "text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20"
              : "text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/20",
          )}
        >
          {tipo === "origen" ? (
            <ArrowRight className="w-3 h-3 shrink-0" />
          ) : (
            <ArrowLeft className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{vinculadoCon.nombres.join("  +  ")}</span>
          {vinculadoCon.nombres.length > 1 && (
            <span className="shrink-0 text-[10px] font-bold bg-white/60 dark:bg-white/10 border border-current/20 rounded-full px-1.5">
              {vinculadoCon.nombres.length}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 dark:text-slate-500 text-center p-6">{children}</div>;
}
