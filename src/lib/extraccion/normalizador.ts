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
    nota: raw.nota,
    semestre: raw.semestre_origen,
    tipo: raw.tipo ?? "materia",
    metadatos: raw.metadatos ?? null,
  };
}

function normalizarCompetenciaSENA(
  raw: MateriaExtraida,
): Omit<UnidadAcademicaNormalizada, "textoEmbedding"> {
  const texto = raw.nombre;
  const matchCompetencia = texto.match(/^Competencia:\s*\n([\s\S]+?)(?:\n\nResultados de aprendizaje:)?/);
  const nombreLimpio = matchCompetencia
    ? matchCompetencia[1].trim()
    : texto.replace(/^Competencia:\s*\n?/, "").split("\n\nResultados de aprendizaje:")[0].trim();

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
  const metaLimpio = raw.metadatos
    ? { ...(raw.metadatos as Record<string, unknown>), resultados_aprendizaje: undefined }
    : null;

  return {
    nombre: nombreLimpio,
    descripcion,
    componentes: ras,
    creditos: raw.creditos,
    nota: raw.nota,
    semestre: raw.semestre_origen,
    tipo: raw.tipo ?? "competencia",
    metadatos: metaLimpio,
  };
}
