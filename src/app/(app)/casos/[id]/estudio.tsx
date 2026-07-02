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
import { vincular, desvincular, finalizarCaso, confirmarSugerencias } from "./acciones";
import { BotonReprocesar } from "./boton-reprocesar";
import { SelectorPlantilla } from "./selector-plantilla";

export type MateriaStudio = {
  id: string;
  codigo: string | null;
  nombre: string;
  creditos: number | null;
  nota: string | null;
  semestre: number | null;
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
  const [origen, setOrigen] = useState<string | null>(null); // materia_origen seleccionada
  const [destino, setDestino] = useState<string | null>(null); // asignatura seleccionada
  const [columnaMovil, setColumnaMovil] = useState<"origen" | "destino">("origen"); // pestaña activa en móvil
  const [semestre, setSemestre] = useState(
    caso.semestreSugerido != null ? String(caso.semestreSugerido) : "",
  );
  const [nota, setNota] = useState(caso.notaAdmin ?? "");
  const [notaInterna, setNotaInterna] = useState(caso.notaInterna ?? "");

  const { cerrado } = caso;
  const vinculoDeMateria = (id: string) => vinculos.find((v) => v.materiaOrigenId === id) ?? null;
  const vinculoDeAsignatura = (id: string) => vinculos.find((v) => v.asignaturaId === id) ?? null;
  const aprobadas = vinculos.filter((v) => v.estado === "aprobado").length;
  const pct = materias.length > 0 ? Math.round((aprobadas / materias.length) * 100) : 0;
  const vinculoOrigen = origen ? vinculoDeMateria(origen) : null;
  // La sugerencia de la IA llega como vínculo 'pendiente'; si el admin ya la aprobó, queda 'aprobado'.
  const sugerenciaPendiente = !!vinculoOrigen && vinculoOrigen.estado !== "aprobado";

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
    setOrigen(null);
    setDestino(null);
  }

  function hacerVincular() {
    if (!origen || !destino) return;
    const existente = vinculoDeMateria(origen);
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", caso.id);
      fd.set("materiaOrigenId", origen);
      fd.set("asignaturaId", destino);
      fd.set("vinculoId", existente?.id ?? "");
      await vincular(fd);
      sileo.success({ title: "Materias vinculadas" });
      limpiar();
    });
  }

  function hacerDesvincular() {
    const existente = origen ? vinculoDeMateria(origen) : null;
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

  // Aprueba de un solo clic la homologación que sugirió la IA para la materia seleccionada, sin que
  // el admin tenga que volver a elegir la asignatura destino. Reusa la pareja que ya propuso la IA.
  function hacerConfirmar() {
    if (!origen || !vinculoOrigen) return;
    iniciar(async () => {
      const fd = new FormData();
      fd.set("casoId", caso.id);
      fd.set("materiaOrigenId", origen);
      fd.set("asignaturaId", vinculoOrigen.asignaturaId);
      fd.set("vinculoId", vinculoOrigen.id);
      await vincular(fd);
      sileo.success({ title: "Vinculación confirmada" });
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
                  <input
                    id="sem-final"
                    type="number"
                    min={1}
                    value={semestre}
                    onChange={(e) => setSemestre(e.target.value)}
                    className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="nota-interna" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Nota interna{" "}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">(no la ve el estudiante)</span>
                  </label>
                  <textarea
                    id="nota-interna"
                    value={notaInterna}
                    onChange={(e) => setNotaInterna(e.target.value)}
                    rows={2}
                    placeholder="Ej.: Falta confirmar créditos de Cálculo II con el coordinador."
                    className="w-full px-3 py-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none text-sm text-slate-700 dark:text-amber-50 placeholder:text-amber-700/40 dark:placeholder:text-amber-200/30"
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  onClick={() => hacerFinalizar("rechazado")}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 hover:bg-red-50 disabled:opacity-50"
                >
                  Rechazar caso
                </button>
                <button
                  onClick={() => hacerFinalizar("aprobado")}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-marca text-marca-fg hover:bg-marca-hover dark:bg-marca-hover dark:hover:bg-marca disabled:opacity-50"
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
          {agrupar(materiasOrdenadas).map(([sem, items]) => (
            <GrupoSemestre key={`o-${sem}`} sem={sem}>
              {items.map((m) => {
                const v = vinculoDeMateria(m.id);
                const seleccionada = origen === m.id;
                const dest = v ? asignaturaPorId.get(v.asignaturaId) : null;
                // Avisos académicos: nota por debajo del mínimo, o destino con más créditos que el
                // origen (se estaría homologando una materia "más pesada" con una más liviana).
                const notaNum = parseNota(m.nota);
                const avisos: string[] = [];
                if (notaNum != null && notaNum < notaMinima) {
                  avisos.push(`Nota ${notaNum} (mín. ${notaMinima})`);
                }
                if (dest && m.creditos != null && dest.creditos > m.creditos) {
                  avisos.push(`Créditos ${m.creditos}→${dest.creditos}`);
                }
                return (
                  <Tarjeta
                    key={m.id}
                    idElemento={`card-mat-${m.id}`}
                    codigo={m.codigo}
                    nombre={m.nombre}
                    creditos={m.creditos}
                    nota={m.nota}
                    alerta={avisos.length > 0 ? avisos.join(" · ") : undefined}
                    estado={v?.estado ?? null}
                    vinculadoCon={
                      dest ? { nombre: dest.nombre, aprobado: v?.estado === "aprobado" } : undefined
                    }
                    seleccionada={seleccionada}
                    resaltada={destino != null && v?.asignaturaId === destino}
                    tipo="origen"
                    onClick={cerrado ? undefined : () => setOrigen(seleccionada ? null : m.id)}
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
                const v = vinculoDeAsignatura(a.id);
                const seleccionada = destino === a.id;
                const orig = v ? materiaPorId.get(v.materiaOrigenId) : null;
                return (
                  <Tarjeta
                    key={a.id}
                    idElemento={`card-asig-${a.id}`}
                    codigo={a.codigo}
                    nombre={a.nombre}
                    creditos={a.creditos}
                    nota={null}
                    similitud={v && v.estado !== "aprobado" ? v.similitud : undefined}
                    razon={v?.razon ?? undefined}
                    vinculada={v?.estado === "aprobado"}
                    estado={v?.estado ?? null}
                    vinculadoCon={
                      orig ? { nombre: orig.nombre, aprobado: v?.estado === "aprobado" } : undefined
                    }
                    seleccionada={seleccionada}
                    resaltada={origen != null && v?.materiaOrigenId === origen}
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
        {!cerrado && origen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="absolute bottom-4 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 z-40 border border-white/10"
          >
            <div className="text-center md:text-left min-w-0">
              <span className="text-sm font-medium block">
                {destino
                  ? "Vincular la materia con la asignatura"
                  : sugerenciaPendiente
                    ? "La IA sugirió esta homologación"
                    : vinculoOrigen
                      ? "Materia ya homologada"
                      : "Elige una asignatura destino"}
              </span>
              {/* La justificación de la IA, para que el admin entienda el porqué de la sugerencia. */}
              {/* La barra es SIEMPRE oscura: nada de variantes dark: aquí (un dark:text-slate-500
                  la volvía ilegible sobre el fondo oscuro). */}
              {!destino && sugerenciaPendiente && vinculoOrigen?.razon && (
                <span className="text-xs text-slate-400 block mt-0.5 max-w-md">
                  {vinculoOrigen.razon}
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
                  <LinkIcon className="w-4 h-4" /> Vincular
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
            {/* px-1/pb-1: dejan aire para que el anillo de selección (ring-2) NO se corte con el
                overflow-hidden de la animación de despliegue. */}
            <div className="space-y-2.5 px-1 pt-2 pb-1">{children}</div>
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
}: {
  idElemento: string;
  codigo: string | null;
  nombre: string;
  creditos: number | null;
  nota: string | null;
  similitud?: number;
  razon?: string;
  alerta?: string;
  vinculada?: boolean;
  estado: EstadoVinculo | null;
  vinculadoCon?: { nombre: string; aprobado: boolean };
  seleccionada: boolean;
  resaltada: boolean;
  tipo: "origen" | "destino";
  onClick?: () => void;
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

  // La SELECCIÓN / RELACIÓN se marca con un anillo AZUL CIELO (sky): distinto de los colores de
  // estado (ámbar/verde) y del color de marca, y brillante para resaltar en los temas oscuros. La
  // tarjeta seleccionada lleva anillo sólido + sombra; su pareja en la otra columna, el mismo anillo
  // más tenue, para leer la conexión de un vistazo.
  const claseSeleccion = seleccionada
    ? "ring-2 ring-sky-500 dark:ring-sky-400 shadow-lg shadow-sky-500/15"
    : resaltada
      ? "ring-2 ring-sky-500/60 dark:ring-sky-400/50"
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
        "scroll-mt-4 rounded-xl border border-l-4 p-3.5 transition-all select-none",
        "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
        claseEstado,
        claseSeleccion,
        // El hover NO toca el borde (pisaría el color de la barra izquierda por especificidad de
        // :hover): la elevación la dan la sombra y el whileHover de motion.
        onClick && "cursor-pointer hover:shadow-md dark:hover:shadow-black/30",
      )}
    >
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
      </div>
      {/* El nombre es SIEMPRE neutro: qué columna es ya lo dice el encabezado de la columna. Antes el
          destino iba en azul fijo, que chocaba con el color de marca y con los temas oscuros azulados. */}
      <h3 className="font-bold text-sm leading-snug text-slate-800 dark:text-slate-100">{nombre}</h3>
      <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {creditos != null && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{creditos} CR</span>}
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
          <span className="truncate">{vinculadoCon.nombre}</span>
        </div>
      )}
    </motion.div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 dark:text-slate-500 text-center p-6">{children}</div>;
}
