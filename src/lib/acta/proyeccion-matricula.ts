/**
 * Algoritmo inteligente de proyección de asignaturas para matrícula (Artículo 3° de la Resolución).
 *
 * Determina los cursos sugeridos que el estudiante debe matricular en su período de ingreso:
 * 1. Excluye asignaturas ya homologadas (por ID o por coincidencia de nombre normalizado).
 * 2. Prioriza asignaturas rezagadas de semestres anteriores al semestre de ingreso (semestre < S_ingreso).
 * 3. Incorpora las asignaturas correspondientes al semestre de ingreso (semestre === S_ingreso).
 * 4. Si faltan materias para alcanzar el estándar de 5-6 materias (por defecto meta = 6),
 *    completa con asignaturas de semestres superiores inmediatos (S+1, S+2...).
 */

export type AsignaturaProyeccion = {
  id: string;
  codigo: string | null;
  nombre: string;
  semestre: number;
  creditos: number;
};

export type HomologadasFiltro = {
  ids?: Iterable<string>;
  nombres?: Iterable<string>;
};

/**
 * Normaliza una cadena de texto eliminando acentos, caracteres diacríticos y espacios repetidos.
 */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Proyecta los cursos recomendados para matrícula en el primer período.
 */
export function proyectarCursosAutomaticos(
  todasAsignaturas: AsignaturaProyeccion[],
  homologadas: HomologadasFiltro | Iterable<string>,
  semestreIngreso: number = 1,
  metaMaterias: number = 6,
): AsignaturaProyeccion[] {
  const idsSet = new Set<string>();
  const nombresSet = new Set<string>();

  if (homologadas && typeof homologadas === "object") {
    if (Symbol.iterator in homologadas) {
      for (const item of homologadas as Iterable<string>) {
        if (!item) continue;
        idsSet.add(item);
        nombresSet.add(normalizarNombre(item));
      }
    } else {
      const filtro = homologadas as HomologadasFiltro;
      if (filtro.ids) {
        for (const id of filtro.ids) {
          if (id) idsSet.add(id);
        }
      }
      if (filtro.nombres) {
        for (const nom of filtro.nombres) {
          if (nom) nombresSet.add(normalizarNombre(nom));
        }
      }
    }
  }

  // Filtrar asignaturas no homologadas
  const disponibles = todasAsignaturas.filter((a) => {
    if (a.id && idsSet.has(a.id)) return false;
    if (nombresSet.has(normalizarNombre(a.nombre))) return false;
    return true;
  });

  const sIngreso = Math.max(1, Math.floor(semestreIngreso || 1));

  // 1. Rezagadas: semestres anteriores al ingreso
  const rezagadas = disponibles
    .filter((a) => a.semestre < sIngreso)
    .sort(
      (a, b) =>
        a.semestre - b.semestre ||
        (a.codigo ?? "").localeCompare(b.codigo ?? "", "es", { numeric: true }) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  // 2. Semestre de ingreso actual
  const delSemestre = disponibles
    .filter((a) => a.semestre === sIngreso)
    .sort(
      (a, b) =>
        (a.codigo ?? "").localeCompare(b.codigo ?? "", "es", { numeric: true }) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  // 3. Superiores: semestres posteriores al de ingreso
  const superiores = disponibles
    .filter((a) => a.semestre > sIngreso)
    .sort(
      (a, b) =>
        a.semestre - b.semestre ||
        (a.codigo ?? "").localeCompare(b.codigo ?? "", "es", { numeric: true }) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  const resultado: AsignaturaProyeccion[] = [];

  // Agregar rezagadas primero
  for (const asig of rezagadas) {
    if (resultado.length >= metaMaterias) break;
    resultado.push(asig);
  }

  // Agregar materias del semestre actual
  for (const asig of delSemestre) {
    if (resultado.length >= metaMaterias) break;
    resultado.push(asig);
  }

  // Si aún no se alcanza la meta, completar con superiores
  for (const asig of superiores) {
    if (resultado.length >= metaMaterias) break;
    resultado.push(asig);
  }

  return resultado;
}
