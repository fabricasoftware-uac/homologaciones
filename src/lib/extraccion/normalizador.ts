import type { MateriaExtraida } from "@/lib/groq/extraer-materias";
import type { UnidadAcademicaNormalizada } from "./tipos";

export function normalizarUnidad(raw: MateriaExtraida): UnidadAcademicaNormalizada {
  const base = raw.tipo === "competencia"
    ? normalizarCompetenciaSENA(raw)
    : normalizarMateriaUniversitaria(raw);

  return {
    ...base,
    textoEmbedding: construirTextoEmbedding(base),
  };
}

export function normalizar(raw: MateriaExtraida[]): UnidadAcademicaNormalizada[] {
  return raw.map(normalizarUnidad);
}

function construirTextoEmbedding(u: Omit<UnidadAcademicaNormalizada, "textoEmbedding">): string {
  const partes = [u.nombre];
  if (u.descripcion !== u.nombre) partes.push(u.descripcion);
  if (u.componentes.length > 0) partes.push(u.componentes.join("\n"));
  return partes.join("\n");
}

function normalizarMateriaUniversitaria(
  raw: MateriaExtraida,
): Omit<UnidadAcademicaNormalizada, "textoEmbedding"> {
  const nombre = raw.nombre.trim();

  return {
    nombre,
    descripcion: nombre,
    componentes: [],
    creditos: raw.creditos,
    intensidadHoraria: raw.intensidadHoraria ?? null,
    nota: raw.nota,
    semestre: raw.semestre_origen,
    tipo: raw.tipo ?? "materia",
    metadatos: raw.metadatos ?? null,
  };
}

// Conversión de horas SENA a créditos académicos. El SENA mide en INTENSIDAD HORARIA (IH); las
// universidades en créditos. Estándar colombiano (Decreto 1330): 1 crédito = 48 horas de trabajo
// académico. Sin esto, una competencia de 1008 horas aparecía como "1008 créditos" en el panel.
// Las horas originales se conservan en metadatos.intensidad_horaria.
const HORAS_POR_CREDITO = 48;

function horasACreditos(horas: number | null): number | null {
  if (horas === null || !Number.isFinite(horas) || horas <= 0) return null;
  return Math.max(1, Math.round(horas / HORAS_POR_CREDITO));
}

function normalizarCompetenciaSENA(
  raw: MateriaExtraida,
): Omit<UnidadAcademicaNormalizada, "textoEmbedding"> {
  const texto = raw.nombre;
  // OJO: nada de regex perezoso con terminador opcional aquí — /([\s\S]+?)(?:...)?/ matchea UN solo
  // carácter (el nombre quedaba truncado a su primera letra en la BD y el panel mostraba "E", "G"...).
  // El split es determinístico: todo lo anterior al bloque de RAs, sin el prefijo "Competencia:".
  const nombreLimpio = texto
    .replace(/^Competencia:\s*\n?/, "")
    .split("\n\nResultados de aprendizaje:")[0]
    .trim();

  let ras: string[] = [];
  const metadatos = raw.metadatos as { resultados_aprendizaje?: string[] } | null | undefined;
  if (metadatos?.resultados_aprendizaje && metadatos.resultados_aprendizaje.length > 0) {
    ras = metadatos.resultados_aprendizaje;
  } else {
    const bloqueRA = texto.split("\n\nResultados de aprendizaje:\n")[1];
    if (bloqueRA) {
      ras = bloqueRA
        .split(/\n-\s*/)
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
    }
  }

  const descripcion = ras.length > 0
    ? `${nombreLimpio}\n\nResultados de aprendizaje:\n${ras.map((r) => `- ${r}`).join("\n")}`
    : nombreLimpio;

  // Solo guardamos en metadatos lo que NO tiene esquema definido. Los RAs ya están en componentes.
  // Las horas originales (IH) se conservan aquí: `creditos` lleva la CONVERSIÓN a créditos.
  const metaLimpio: Record<string, unknown> = {
    ...((raw.metadatos as Record<string, unknown>) ?? {}),
    resultados_aprendizaje: undefined,
    intensidad_horaria: raw.creditos,
  };

  return {
    nombre: nombreLimpio,
    descripcion,
    componentes: ras,
    creditos: raw.creditos,
    intensidadHoraria: raw.intensidadHoraria ?? null,
    nota: raw.nota,
    semestre: raw.semestre_origen,
    tipo: raw.tipo ?? "competencia",
    metadatos: metaLimpio,
  };
}
