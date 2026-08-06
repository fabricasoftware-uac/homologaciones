// La escala de notas colombiana: 0.0 a 5.0, y una materia se GANA desde 3.0.
//
// Este es el único lugar donde se interpreta una nota como número. Antes había dos copias de la
// misma lógica —el estudio y el parser de seguimiento— y cualquier arreglo en una dejaba la otra
// desalineada; que el panel y el filtro de extracción entiendan "3.0" distinto sería el peor de los
// errores posibles aquí: el asesor vería una regla y el sistema aplicaría otra.
//
// OJO: este archivo NO IMPORTA NADA a propósito. Lo usan el pipeline de extracción (servidor) y el
// estudio (componente de cliente); si algún día importara de `@/lib/ia` o `@/lib/pdf`, el bundle del
// navegador se llevaría por delante unpdf y el cliente de OpenRouter.

/** Tope de la escala colombiana. Por encima de esto la nota viene en otra escala (0-100). */
export const NOTA_MAXIMA = 5;

/** Mínimo para dar una materia por ganada. Es el valor por defecto de `configuracion.nota_minima`. */
export const NOTA_MINIMA_APROBACION = 3;

/**
 * Convierte la nota (texto libre del certificado) a número en escala 0-5.
 *
 * Tolera la coma decimal y la letra que algunos reportes cuelgan de la nota ("1.6H"). Devuelve null
 * cuando no hay número que sacar ("APROBADO", "A", relleno): eso NO significa reprobada, significa
 * que no se puede puntuar — lo decide `esNotaAprobada`.
 */
export function notaANumero(nota: string | null | undefined): number | null {
  if (!nota) return null;
  const limpio = nota.replace(",", ".").replace(/[^\d.]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  // Certificados en escala 0-100: se bajan a 0-5 (70/100 = 3.5/5).
  return n > NOTA_MAXIMA && n <= 100 ? n / 20 : n;
}

// Notas escritas en palabras. Solo hace falta reconocer las NEGATIVAS: cualquier otro texto
// ("APROBADO", "SUFICIENTE", "A") se da por bueno, porque no hay forma de puntuarlo y dar por
// perdida una materia que el documento no califica sería inventar.
const REPROBADA =
  /^(NO\s*APROBAD[OA]|REPROBAD[OA]|PERDID[OA]|INSUFICIENTE|DEFICIENTE|CANCELAD[OA]|RETIRAD[OA]|ANULAD[OA]|DESERT[OÓ])\.?$/i;

/**
 * ¿La materia está ganada? Solo las ganadas se pueden homologar.
 *
 * - Con número: se compara contra el mínimo (3.0 por defecto, configurable en `/configuracion`).
 * - Sin número: se aprueba salvo que el documento diga explícitamente que no.
 * - Sin nota: false. Una materia sin calificar no está ganada.
 */
export function esNotaAprobada(
  nota: string | null | undefined,
  minima: number = NOTA_MINIMA_APROBACION,
): boolean {
  if (!nota) return false;
  const n = notaANumero(nota);
  if (n !== null) return n >= minima;

  // Sin número y sin letras es relleno de celda ("*****", "---"): no es una nota, no aprueba nada.
  // El pipeline ya lo limpia antes (normalizarNota), pero esta función es pública y no puede
  // devolver "aprobada" ante una celda vacía por el hecho de no decir "reprobada".
  const texto = nota.replace(/\s+/g, " ").trim();
  if (!/\p{L}/u.test(texto)) return false;
  return !REPROBADA.test(texto);
}
