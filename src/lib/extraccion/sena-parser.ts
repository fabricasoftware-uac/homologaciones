import type { MateriaExtraida, Extractor } from "./tipos";

// Parser determinístico (0 tokens) para constancias de formación titulada del SENA.
//
// Estructura real del documento (verificada contra constancias reales):
//
//   [encabezado institucional] ha aprobado: [NOMBRE COMPETENCIA 1] [nota] [A|D]
//   REGISTRO DE COMPETENCIAS EVALUADAS EVAL IH [horas] RESULTADOS DE APRENDIZAJE
//   01 [RA...] 02 [RA...] ... [Nombre competencia 2] [nota] [A|D] REGISTRO ... etc.
//
// El parser anterior usaba UN solo regex codicioso que desalineaba los bloques 2+ (los nombres
// quedaban absorbidos por el bloque anterior y salían como basura "4,5 A REGISTRO..."), y además
// perdía competencias. Este parser es ESTRUCTURAL:
//
//   1. Limpia encabezados de página ("Ministerio de Trabajo ... Página N de M") y el cierre
//      (firma del subdirector + "Se expide en...") que se intercalan en el texto.
//   2. Ubica cada MARCADOR "[nota] [A|D] REGISTRO DE COMPETENCIAS EVALUADAS EVAL IH [h]
//      RESULTADOS DE APRENDIZAJE": uno por competencia, con su nota y sus horas.
//   3. El NOMBRE de la competencia K es la cola del segmento ANTERIOR a su marcador. Se detecta
//      con DOS señales combinadas (los nombres aparecen en ambos formatos): (a) cola en caso mixto
//      —los RAs van EN MAYÚSCULAS y muchos nombres en minúscula mixta—, y (b) la última ORACIÓN del
//      segmento —para nombres en mayúsculas, que quedan separados del último RA por un punto—. Gana
//      la señal que empiece más tarde (la más conservadora: absorbe menos texto de RA). El primer
//      nombre es especial: viene tras "ha aprobado:".
//   4. Los RAs de la competencia K son el segmento POSTERIOR a su marcador, recortando el nombre
//      de la competencia K+1 que cuelga al final, y separando por la numeración "01 ", "02 "...

const MARCADOR =
  /([\d,]+)\s+([AD])\s+REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS\s+EVAL\s+IH\s+(\d+)\s+RESULTADOS\s+DE\s+APRENDIZAJE/g;

const tieneMinuscula = (w: string) => /[a-záéíóúñü]/.test(w);

type Cola = { nombre: string; inicioNombre: number };

const SIN_NOMBRE: Cola = { nombre: "", inicioNombre: -1 };
const NOMBRE_MIN = 15; // menos que esto no es un nombre de competencia (es un residuo de RA)
const NOMBRE_MAX = 250; // más que esto absorbió texto de RA: se descarta la señal

// Señal (a): cola en caso mixto. Recorre las palabras desde el final mientras tengan minúsculas;
// tolera acrónimos cortos (TIC, SST) si están rodeados de palabras con minúsculas.
function colaCasoMixto(segmento: string): Cola {
  const tokens = [...segmento.matchAll(/\S+/g)];
  let inicio = tokens.length; // índice del primer token que pertenece al nombre

  for (let i = tokens.length - 1; i >= 0; i--) {
    const w = tokens[i][0];
    if (tieneMinuscula(w)) {
      inicio = i;
      continue;
    }
    const esAcronimo = w.replace(/[^\p{L}]/gu, "").length <= 5;
    const anterior = i > 0 ? tokens[i - 1][0] : "";
    if (esAcronimo && inicio < tokens.length && tieneMinuscula(anterior)) {
      inicio = i;
      continue;
    }
    break;
  }

  if (inicio >= tokens.length) return SIN_NOMBRE;
  const pos = tokens[inicio].index ?? 0;
  return { nombre: segmento.slice(pos).replace(/[.\s]+$/, "").trim(), inicioNombre: pos };
}

// Señal (b): última ORACIÓN del segmento (tras el último ". "), para nombres en MAYÚSCULAS que el
// punto del último RA separa. Se ignora el punto final del propio nombre si lo trae.
function ultimaOracion(segmento: string): Cola {
  const base = segmento.replace(/[.\s]+$/, "");
  const ultimoPunto = base.lastIndexOf(". ");
  if (ultimoPunto === -1) return SIN_NOMBRE;
  const inicio = ultimoPunto + 2;
  return { nombre: base.slice(inicio).trim(), inicioNombre: inicio };
}

// Nombre de la competencia al final de un segmento: combina ambas señales y elige la que empiece
// MÁS TARDE (la más conservadora). Filtra candidatas fuera de rango (residuos o sobre-capturas).
function nombreDesdeCola(segmento: string): Cola {
  const candidatas = [colaCasoMixto(segmento), ultimaOracion(segmento)].filter(
    (c) => c.inicioNombre >= 0 && c.nombre.length >= NOMBRE_MIN && c.nombre.length <= NOMBRE_MAX,
  );
  if (candidatas.length === 0) return { nombre: "", inicioNombre: segmento.length };
  candidatas.sort((a, b) => b.inicioNombre - a.inicioNombre);
  return candidatas[0];
}

// El primer nombre viene tras "ha aprobado:" en el encabezado (y en MAYÚSCULAS, así que la señal
// de caso mixto no aplica). Fallback: la última oración del segmento.
function nombrePrimero(segmento: string): string {
  const m = segmento.match(/aprobado:\s*(.+)$/i);
  if (m) return m[1].replace(/[.\s]+$/, "").trim();
  const ultimaOracion = segmento.split(".").at(-1)?.trim() ?? "";
  return (ultimaOracion || segmento).replace(/[.\s]+$/, "").trim();
}

export class SenaParser implements Extractor {
  readonly nombre = "SenaParser";

  async extraer(texto: string): Promise<MateriaExtraida[]> {
    let txt = texto.replace(/\s+/g, " ").trim();

    // 1. Limpieza: encabezados de página y cierre (firma + expedición). El encabezado repite en
    // cada página el membrete + nombre del estudiante + "Página N de M".
    txt = txt.replace(/Ministerio de Trabajo.*?Página\s+\d+\s+de\s+\d+/gi, " ");
    txt = txt.replace(/\s+(?:[A-ZÁÉÍÓÚÑÜ.]+\s+){1,8}SUBDIRECTOR\s*\(A\).*$/i, " ");
    txt = txt.replace(/Se expide en.*$/i, " ");
    txt = txt.replace(/\s+/g, " ").trim();

    // 2. Marcadores: uno por competencia (nota, evaluación y horas viven en el marcador).
    const marcas: { inicio: number; fin: number; nota: string; evaluacion: string; ih: number }[] = [];
    let m: RegExpExecArray | null;
    MARCADOR.lastIndex = 0;
    while ((m = MARCADOR.exec(txt)) !== null) {
      marcas.push({
        inicio: m.index,
        fin: m.index + m[0].length,
        nota: m[1],
        evaluacion: m[2],
        ih: parseInt(m[3], 10),
      });
    }
    if (marcas.length === 0) {
      console.warn("[extraccion] SenaParser: no se encontraron marcadores de competencias.");
      return [];
    }

    // 3. Nombres: cola del segmento anterior a cada marcador.
    const nombres: string[] = [];
    for (let k = 0; k < marcas.length; k++) {
      const desde = k === 0 ? 0 : marcas[k - 1].fin;
      const seg = txt.slice(desde, marcas[k].inicio).trim();
      nombres.push(k === 0 ? nombrePrimero(seg) : nombreDesdeCola(seg).nombre);
    }

    // 4. RAs + armado de unidades.
    const unidades: MateriaExtraida[] = [];
    for (let k = 0; k < marcas.length; k++) {
      const hasta = k + 1 < marcas.length ? marcas[k + 1].inicio : txt.length;
      let seg = txt.slice(marcas[k].fin, hasta).trim();
      // El nombre de la SIGUIENTE competencia cuelga al final de este segmento: se recorta.
      if (k + 1 < marcas.length) {
        const { inicioNombre } = nombreDesdeCola(seg);
        seg = seg.slice(0, inicioNombre).trim();
      }

      const ras = seg
        .split(/\s+(?=\d{2}\s)/)
        .map((p) => p.replace(/^\d{2}\s+/, "").replace(/\s+/g, " ").trim())
        .filter((r) => r.length > 10);

      const nombre = nombres[k] || `Competencia ${k + 1}`;
      const raFormateado =
        ras.length > 0
          ? "\n\nResultados de aprendizaje:\n" + ras.map((r) => `- ${r}`).join("\n")
          : "";
      const nota =
        marcas[k].evaluacion === "A" ? "Aprobado" : marcas[k].evaluacion === "D" ? "No aprobado" : marcas[k].evaluacion;

      unidades.push({
        nombre: `Competencia:\n${nombre}${raFormateado}`,
        codigo: null,
        creditos: marcas[k].ih,
        nota,
        semestre_origen: null,
        tipo: "competencia",
        metadatos: { resultados_aprendizaje: ras },
      });
    }

    console.log(`[extraccion] SenaParser extrajo ${unidades.length} competencias.`);
    return unidades;
  }
}
