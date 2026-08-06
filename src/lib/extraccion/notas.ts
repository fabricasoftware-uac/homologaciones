import { esNotaAprobada, NOTA_MINIMA_APROBACION } from "./escala-nota";
import type { MateriaExtraida } from "./tipos";

// Qué llega al panel del asesor y qué no. Dos reglas, en este orden:
//
//   1. SIN NOTA no es una materia cursada: es una casilla del plan de estudios.
//   2. SIN GANAR no es homologable: solo se homologa lo que el estudiante aprobó (>= 3.0 en la
//      escala colombiana 0.0-5.0; el mínimo real sale de `configuracion.nota_minima`).
//
// Muchos certificados (y todos los reportes de "seguimiento de pensum") listan la carrera COMPLETA y
// marcan lo no cursado con relleno —asteriscos, guiones, celdas vacías—. Sin la primera regla
// llegaban al panel las ~60 materias del plan; sin la segunda, llegaban también las perdidas, que el
// asesor tenía que rechazar una por una sabiendo de antemano que ninguna se puede homologar.
//
// El SeguimientoPensumParser ya no produce las que no tienen nota (lee la nota de la fila), pero sí
// las reprobadas: filtrarlas es política, no lectura, y por eso vive aquí y no en el parser — que
// necesita las reprobadas para cuadrar sus créditos aprobados contra los que declara el reporte.
//
// El camino del SENA NO pasa por aquí: sus competencias vienen con "Aprobado"/"No aprobado" y su
// extracción tiene sus propias reglas (ver ADR-003).

// Relleno de celda vacía: solo símbolos ("*****", "---", "..."). No es una calificación.
const RELLENO = /^[\s*.\-_/|]+$/;

// Estados que el documento imprime EN LUGAR de una nota: la materia está en curso o sin calificar.
// No son notas, y una materia sin calificar todavía no se puede homologar.
const SIN_CALIFICAR =
  /^(N\s*\/?\s*A|NA|N\/D|ND|SIN\s*NOTA|SIN\s*CALIFICAR|NO\s*APLICA|PENDIENTE|EN\s*CURSO|CURSANDO|MATRICULAD[OA]|INSCRIT[OA])$/i;

/** Devuelve la nota si es una calificación de verdad; null si es relleno, vacío o "en curso". */
export function normalizarNota(nota: string | null | undefined): string | null {
  if (!nota) return null;
  const limpio = nota.replace(/\s+/g, " ").trim();
  if (limpio.length === 0) return null;
  if (RELLENO.test(limpio)) return null;
  if (SIN_CALIFICAR.test(limpio)) return null;
  return limpio;
}

/**
 * Deja solo lo que se puede homologar: materias con calificación real y GANADA.
 *
 * Excepción deliberada: si NINGUNA unidad del documento trae nota, el certificado sencillamente no
 * reporta calificaciones (los hay: constancias de materias cursadas, planes firmados). Ahí no se
 * filtra nada —ni por nota ni por aprobación—: dejar el caso VACÍO es peor que traer de más, y sin
 * notas no hay con qué decidir.
 *
 * @param notaMinima Mínimo para dar la materia por ganada. Sale de `configuracion.nota_minima`, que
 *   el admin edita en `/configuracion`; por defecto 3.0.
 */
export function filtrarHomologables(
  unidades: MateriaExtraida[],
  notaMinima: number = NOTA_MINIMA_APROBACION,
): MateriaExtraida[] {
  const limpias = unidades.map((u) => ({ ...u, nota: normalizarNota(u.nota) }));

  if (!limpias.some((u) => u.nota !== null)) {
    console.log(
      "[extraccion] El documento no reporta calificaciones: se conservan las " +
        `${limpias.length} unidades extraídas (filtrar dejaría el caso vacío).`,
    );
    return limpias;
  }

  const conNota = limpias.filter((u) => u.nota !== null);
  const aprobadas = conNota.filter((u) => esNotaAprobada(u.nota, notaMinima));

  const sinNota = limpias.length - conNota.length;
  const reprobadas = conNota.length - aprobadas.length;
  if (sinNota > 0 || reprobadas > 0) {
    console.log(
      `[extraccion] Descartadas ${sinNota} unidad(es) sin calificación (no cursadas) y ` +
        `${reprobadas} reprobada(s) (nota < ${notaMinima}) → ${aprobadas.length} materias homologables.`,
    );
  }
  return aprobadas;
}
