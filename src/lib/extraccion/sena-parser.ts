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

// ── Saneo del texto crudo (constancias reales, jul-2026) ──
//
// Algunas constancias traen los RAs con TRACKING POR CARÁCTER: el generador de PDF posiciona cada
// letra por separado y la capa de texto sale como "0 1 I D E N T I F I C A R M O D E L O S". Los
// límites entre palabras se pierden de verdad (no hay espacio doble que los distinga), así que no
// se pueden reconstruir; el extractor por coordenadas tampoco los recupera. Lo que SÍ importa —y sí
// se puede arreglar— es la NUMERACIÓN: si "01" llega como "0 1", el separador de RAs no dispara y
// dos o más resultados de aprendizaje se fusionan en uno solo. Reparamos únicamente eso.
function repararNumeracionEspaciada(texto: string): string {
  return texto.replace(/(?:^|\s)(\d)\s(\d)(?=\s)/g, (coincidencia, d1, d2) =>
    coincidencia.replace(`${d1} ${d2}`, `${d1}${d2}`),
  );
}

// El nombre de un centro de formación puede venir PEGADO al nombre de la competencia con un guion
// ("Enrique Low Murtra-Interactuar en el contexto productivo..."). Es texto institucional, no parte
// de la competencia: ensucia el embedding y la evidencia que ve el LLM. Se quita solo cuando el
// prefijo son 2-4 palabras capitalizadas seguidas de un guion SIN espacios (la firma del patrón).
function quitarPrefijoInstitucional(nombre: string): string {
  return nombre.replace(
    /^[A-ZÁÉÍÓÚÑ][\p{L}.]*(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}.]*){1,3}-(?=\p{L})/u,
    "",
  );
}

// Separa el bloque de RAs en resultados individuales. La numeración viene como "01 ", "02 " y a
// veces "01- " (con guion). Además descarta los encabezados de página que se cuelan entre páginas
// ("RESULTADOS DE APRENDIZAJE" repetido al reanudar la lista), que antes entraban como si fueran
// un RA más.
function separarResultados(segmento: string): string[] {
  return repararNumeracionEspaciada(segmento)
    .split(/\s+(?=\d{2}[\s-])/)
    .map((p) =>
      p
        .replace(/^\d{2}[-\s]+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((r) => r.length > 10 && !/^RESULTADOS\s+DE\s+APRENDIZAJE\.?$/i.test(r));
}

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
    const esFormatoNuevo = /COMPETENCIAS\s+EVAL\s+IH/.test(texto) && !/REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS/.test(texto);

    if (esFormatoNuevo) {
      console.log("[extraccion] SenaParser: detectado formato NUEVO (COMPETENCIAS EVAL IH)");
      return this.extraerFormatoNuevo(texto);
    }
    console.log("[extraccion] SenaParser: usando formato clásico");
    return this.extraerFormatoClasico(texto);
  }

  // ── Formato NUEVO (2024+) ──
  // COMPETENCIAS   EVAL   IH
  // [Nombre competencia]   [nota]   [horas]
  // RESULTADOS DE APRENDIZAJE
  // [RAs en cualquier orden]
  private extraerFormatoNuevo(texto: string): MateriaExtraida[] {
    let txt = texto.replace(/\s+/g, " ").trim();

    // Limpiar encabezados de página del nuevo formato
    txt = txt.replace(/S REGIONAL CAUCA\s+SENA:?\s*Una Organización con Conocimiento/gi, " ");
    txt = txt.replace(/La autenticidad de este documento puede ser verificada en el registro electr[oó]nico que se encuentra en la p[aá]gina web\s+https?:\/\/\S+/gi, " ");
    txt = txt.replace(/bajo el n[uú]mero\s+[\dA-Z]+\.?/gi, " ");
    txt = txt.replace(/CERTIFICA/gi, " ");
    txt = txt.replace(/EL CENTRO DE COMERCIO Y SERVICIOS/gi, " ");
    txt = txt.replace(/\s+/g, " ").trim();

    // Regex para el nuevo formato:
    // COMPETENCIAS EVAL IH [nombre] [nota] [horas] RESULTADOS DE APRENDIZAJE [RAs...]
    const regex = /COMPETENCIAS\s+EVAL\s+IH\s+(.+?)\s+([\d.,]+)\s+(\d+)\s+RESULTADOS\s+DE\s+APRENDIZAJE\s+([\s\S]+?)(?=\s*COMPETENCIAS\s+EVAL\s+IH|$)/g;

    const unidades: MateriaExtraida[] = [];
    let m: RegExpExecArray | null;

    while ((m = regex.exec(txt)) !== null) {
      let nombre = quitarPrefijoInstitucional(m[1].replace(/\s+/g, " ").trim());
      const notaRaw = m[2].replace(",", ".");
      const ih = parseInt(m[3], 10);
      const raTexto = m[4];

      // Saltar bloques que no son competencias reales
      if (nombre === "RESULTADOS DE APRENDIZAJE ETAPA PRACTICA") continue;
      if (/registro\s+electr[oó]nico|p[aá]gina\s+web|http/i.test(nombre)) continue;

      // Extraer RAs: vienen numerados pero en cualquier orden (01, 02, 03 o 03, 02, 01...)
      const ras = separarResultados(raTexto);

      const raFormateado = ras.length > 0
        ? "\n\nResultados de aprendizaje:\n" + ras.map((r) => `- ${r}`).join("\n")
        : "";

      unidades.push({
        nombre: `Competencia:\n${nombre}${raFormateado}`,
        codigo: null,
        creditos: ih,
        nota: "Aprobado",
        semestre_origen: null,
        tipo: "competencia",
        metadatos: { resultados_aprendizaje: ras },
        intensidadHoraria: ih,
      });
    }

    console.log(`[extraccion] SenaParser (formato nuevo) extrajo ${unidades.length} competencias.`);
    return unidades;
  }

  // ── Formato CLÁSICO (pre-2024) ──
  // [Nombre competencia] [nota] [A|D] REGISTRO DE COMPETENCIAS EVALUADAS EVAL IH [horas]
  // RESULTADOS DE APRENDIZAJE 01 [RA...] 02 [RA...] ...
  private extraerFormatoClasico(texto: string): MateriaExtraida[] {
    let txt = texto.replace(/\s+/g, " ").trim();

    // Limpieza: encabezados de página y cierre (firma + expedición).
    txt = txt.replace(/Ministerio de Trabajo.*?Página\s+\d+\s+de\s+\d+/gi, " ");
    txt = txt.replace(/\s+(?:[A-ZÁÉÍÓÚÑÜ.]+\s+){1,8}SUBDIRECTOR\s*\(A\).*$/i, " ");
    txt = txt.replace(/Se expide en.*$/i, " ");
    txt = txt.replace(/\s+/g, " ").trim();
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
      console.warn("[extraccion] SenaParser debug: texto tiene", txt.length, "chars. REGISTRO:", /REGISTRO/i.test(txt), "COMPETENCIAS:", /COMPETENCIAS/i.test(txt));
      // Mostrar dónde aparece "COMPETENCIAS" en el texto (para ver si REGISTRO está cerca)
      const idxC = txt.indexOf("COMPETENCIAS");
      if (idxC >= 0) console.warn("[extraccion] SenaParser: contexto cerca de COMPETENCIAS:", txt.substring(Math.max(0, idxC - 30), idxC + 50));
      return [];
    }

    // 3. Nombres: cola del segmento anterior a cada marcador.
    const nombres: string[] = [];
    for (let k = 0; k < marcas.length; k++) {
      const desde = k === 0 ? 0 : marcas[k - 1].fin;
      const seg = txt.slice(desde, marcas[k].inicio).trim();
      const crudo = k === 0 ? nombrePrimero(seg) : nombreDesdeCola(seg).nombre;
      nombres.push(quitarPrefijoInstitucional(crudo));
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

      const ras = separarResultados(seg);

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
        intensidadHoraria: marcas[k].ih,
      });
    }

    console.log(`[extraccion] SenaParser extrajo ${unidades.length} competencias.`);
    return unidades;
  }
}
