import type { HomologacionFila } from "@/components/resultado-homologacion";

export type DatosGraficas = {
  creditosTotales: number;
  creditosHomologados: number;
  porSemestre: {
    semestre: number;
    creditosTotales: number;
    creditosHomologados: number;
  }[];
};

export function computarDatosGraficas(
  asignaturas: { creditos: number; semestre: number }[],
  homologadas: HomologacionFila[],
): DatosGraficas | null {
  if (asignaturas.length === 0) return null;

  const creditosTotales = asignaturas.reduce((s, a) => s + a.creditos, 0);
  if (creditosTotales === 0) return null;

  const homologadasPorAsignatura = new Map<string, number>();
  for (const h of homologadas) {
    if (h.asignatura) {
      const clave = `${h.asignatura.semestre}-${h.asignatura.nombre}`;
      homologadasPorAsignatura.set(clave, h.asignatura.creditos);
    }
  }
  const creditosHomologados = Array.from(homologadasPorAsignatura.values()).reduce(
    (s, c) => s + c,
    0,
  );

  const semestres = new Map<number, { total: number; homologado: number }>();
  for (const a of asignaturas) {
    const entry = semestres.get(a.semestre) ?? { total: 0, homologado: 0 };
    entry.total += a.creditos;
    semestres.set(a.semestre, entry);
  }

  for (const h of homologadas) {
    if (h.asignatura) {
      const entry = semestres.get(h.asignatura.semestre);
      if (entry) {
        entry.homologado += h.asignatura.creditos;
      }
    }
  }

  const porSemestre = Array.from(semestres.entries())
    .map(([semestre, { total, homologado }]) => ({
      semestre,
      creditosTotales: total,
      creditosHomologados: Math.min(homologado, total),
    }))
    .sort((a, b) => a.semestre - b.semestre);

  return { creditosTotales, creditosHomologados, porSemestre };
}
