import { extraerPaginasPdf } from "@/lib/pdf/extraer";

import type { MateriaExtraida, Extractor } from "./tipos";

// Parser determinístico (0 tokens) para constancias de formación titulada del SENA.
//
// Dos formatos, ambos verificados contra constancias reales:
//
//   CLÁSICO (pre-2024)
//     [Nombre competencia] [nota] [A|D] REGISTRO DE COMPETENCIAS EVALUADAS EVAL IH [horas]
//     RESULTADOS DE APRENDIZAJE 01 [RA...] 02 [RA...] ...
//
//   NUEVO (2024+)
//     COMPETENCIAS EVAL IH [Nombre competencia] [nota] [horas]
//     RESULTADOS DE APRENDIZAJE [RAs, en cualquier orden]
//
// ── LA REGLA QUE MANDA EN ESTE ARCHIVO ──
// Perder una competencia EN SILENCIO es el peor fallo posible: el caso sigue adelante, el asesor ve
// una propuesta que parece completa y nadie se entera de que faltan horas. Por eso el parser está
// escrito para que cualquier fila que no se entienda FALLE SOLA y quede contada, en vez de fundirse
// con la vecina. De ahí las tres piezas de abajo (y la reconciliación que devuelve extraerConDiagnostico).
//
// 1. El cromo de página se quita por REPETICIÓN, no por literales (quitarCromoRepetido).
// 2. Primero se PARTE en filas, después se parsea cada fila por separado y anclada. El número de
//    filas queda fijado ANTES de parsear nada, así que existe una cifra contra la cual reconciliar.
// 3. Las filas que son la misma competencia partida por un salto de página se FUSIONAN, con la
//    intensidad horaria en MÁXIMO y nunca en suma.
//
// Historia de lo que ya falló aquí, para no repetirlo:
//   · Un regex codicioso único desalineaba los bloques 2+ (los nombres salían como "4,5 A REGISTRO...").
//   · La limpieza del cromo por literal (/S REGIONAL CAUCA .../) NUNCA disparó: el texto real dice
//     "SREGIONAL CAUCA", sin espacio. Y aunque hubiera acertado, "REGIONAL CAUCA" es de UNA regional:
//     el mismo fallo volvía con cada otro centro del SENA.
//   · Con el cromo dentro de la tabla, el regex perezoso del formato nuevo no fallaba: seguía
//     creciendo hasta la SIGUIENTE fila que calzara, se comía dos filas como una y una competencia
//     desaparecía sin dejar rastro en los logs.

const MARCADOR =
  /([\d,]+)\s+([AD])\s+REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS\s+EVAL\s+IH\s+(\d+)\s+RESULTADOS\s+DE\s+APRENDIZAJE/g;

// ── Cromo de página (encabezados y pies) ──
//
// En cuántas páginas distintas tiene que aparecer una línea IDÉNTICA para considerarla cromo. Tres
// es el mínimo seguro y está medido: en una constancia real, la misma competencia partida por un
// salto de página aparece en 2 páginas (mismo nombre, RAs distintos). Con el umbral en 2 se borraría
// el nombre de una competencia de verdad; con 3, no.
const MIN_PAGINAS_CROMO = 3;

// Estos marcadores TAMBIÉN se repiten en todas las páginas (son encabezados de tabla), pero son lo
// único que le da estructura al documento. Sin este blindaje la detección de cromo se los come sola
// y el parser se queda sin nada por donde partir.
const MARCADORES_ESTRUCTURALES =
  /COMPETENCIAS\s+EVAL\s+IH|RESULTADOS\s+DE\s+APRENDIZAJE|REGISTRO\s+DE\s+COMPETENCIAS/i;

// Quita encabezados y pies SIN nombrar a ninguno: se detectan por aparecer idénticos en varias
// páginas. Esto es lo que hace que el parser sirva en cualquier regional y cualquier centro, y no
// solo en aquellos cuyos literales alguien alcanzó a copiar en un regex.
function quitarCromoRepetido(paginas: string[]): string {
  if (paginas.length < MIN_PAGINAS_CROMO) return paginas.join("\n");

  const frecuencia = new Map<string, number>();
  for (const pagina of paginas) {
    // Un Set por página: lo que importa es en cuántas PÁGINAS sale la línea, no cuántas veces.
    const lineas = new Set(
      pagina
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 8),
    );
    for (const linea of lineas) frecuencia.set(linea, (frecuencia.get(linea) ?? 0) + 1);
  }

  const cromo = new Set<string>();
  for (const [linea, veces] of frecuencia) {
    if (veces < MIN_PAGINAS_CROMO) continue;
    if (MARCADORES_ESTRUCTURALES.test(linea)) continue;
    // Un resultado de aprendizaje viene numerado ("01 ...", "02- ..."). Nunca es cromo, por mucho
    // que se repita: hay RAs cortos y comunes que podrían coincidir entre competencias.
    if (/^\d{2}[\s-]/.test(linea)) continue;
    cromo.add(linea);
  }

  if (cromo.size > 0) {
    console.log(
      `[extraccion] SenaParser: ${cromo.size} línea(s) de encabezado/pie descartadas por repetirse en ≥${MIN_PAGINAS_CROMO} páginas.`,
    );
  }

  return paginas
    .map((p) =>
      p
        .split("\n")
        .filter((l) => !cromo.has(l.trim()))
        .join("\n"),
    )
    .join("\n");
}

// Restos que la detección por repetición NO puede ver, porque cambian en cada página y por tanto
// nunca aparecen dos veces idénticos.
function quitarCromoVariable(txt: string): string {
  return txt
    .replace(/P[áa]gina\s+\d+\s+de\s+\d+/gi, " ")
    .replace(/bajo el n[uú]mero\s+[\dA-Z]+\.?/gi, " ");
}

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
  const trozos = repararNumeracionEspaciada(segmento).split(/\s+(?=\d{2}[\s-])/);
  const numerados = trozos.filter((t) => /^\d{2}[\s-]/.test(t));

  // Los RAs vienen SIEMPRE numerados. Si hay al menos uno con número, lo que NO lo tenga es texto
  // colado —cromo de página que sobrevivió, o la cola del nombre anterior— y sale. Solo puede
  // aparecer al principio del segmento: cualquier cosa que siga a un RA numerado queda dentro de
  // ese trozo. Si NO hay ninguno numerado, el bloque va sin numerar de verdad (la etapa práctica es
  // así) y se conserva entero.
  const utiles = numerados.length > 0 ? numerados : trozos;

  return utiles
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

// ── Fusión de filas partidas por un salto de página ──
//
// El formato nuevo puede listar la MISMA competencia en dos filas cuando cae un salto de página:
// mismo nombre, RAs distintos y la MISMA intensidad horaria repetida en las dos. Si no se fusionan
// salen dos unidades duplicadas que compiten por la misma asignatura; si se fusionan sumando las
// horas, el estudiante cobra el doble. Por eso la IH va en MÁXIMO, nunca en suma.
type FilaSena = { nombre: string; nota: string; ih: number; ras: string[] };

// Clave de comparación: minúsculas, sin tildes y sin puntuación. Los dos trozos de una competencia
// partida pueden diferir en un punto final o en una tilde perdida por la capa de texto.
const claveFusion = (nombre: string) =>
  nombre
    .toLowerCase()
    // NFD separa la tilde de la letra; \p{M} borra esas marcas sueltas. Se escribe con la propiedad
    // Unicode y no con un rango literal para que el archivo fuente siga siendo ASCII imprimible.
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function fusionarFilasRepetidas(filas: FilaSena[]): { filas: FilaSena[]; fusionadas: number } {
  const porNombre = new Map<string, FilaSena>();
  let fusionadas = 0;

  for (const fila of filas) {
    const clave = claveFusion(fila.nombre);
    // Sin clave no hay con qué comparar: la fila se queda sola en vez de fusionarse con cualquiera.
    const previa = clave.length > 0 ? porNombre.get(clave) : undefined;
    if (!previa) {
      porNombre.set(clave.length > 0 ? clave : ` ${porNombre.size}`, {
        ...fila,
        ras: [...fila.ras],
      });
      continue;
    }
    fusionadas++;
    previa.ih = Math.max(previa.ih, fila.ih);
    for (const ra of fila.ras) if (!previa.ras.includes(ra)) previa.ras.push(ra);
  }

  return { filas: [...porNombre.values()], fusionadas };
}

function construirUnidad(fila: FilaSena, nota: string): MateriaExtraida {
  const raFormateado =
    fila.ras.length > 0
      ? "\n\nResultados de aprendizaje:\n" + fila.ras.map((r) => `- ${r}`).join("\n")
      : "";

  return {
    nombre: `Competencia:\n${fila.nombre}${raFormateado}`,
    codigo: null,
    creditos: fila.ih,
    nota,
    semestre_origen: null,
    tipo: "competencia",
    metadatos: { resultados_aprendizaje: fila.ras },
    intensidadHoraria: fila.ih,
  };
}

// Reconciliación: lo que el llamador necesita para saber si puede CONFIAR en el resultado.
// `esperadas` se fija ANTES de parsear (contando filas en el documento), así que es una referencia
// independiente; `fallidas` son las filas que el parser no supo leer. La condición de salud es
// `fallidas === 0` — NO `unidades.length === esperadas`, porque fusionar duplicados baja el total a
// propósito.
export type DiagnosticoSena = {
  unidades: MateriaExtraida[];
  formato: "nuevo" | "clasico";
  esperadas: number;
  fallidas: number;
  fusionadas: number;
};

export class SenaParser implements Extractor {
  readonly nombre = "SenaParser";

  async extraer(texto: string, bytes?: Uint8Array): Promise<MateriaExtraida[]> {
    return (await this.extraerConDiagnostico(texto, bytes)).unidades;
  }

  // Igual que extraer(), pero devuelve además con qué confianza se extrajo. Lo usa el orquestador
  // (src/lib/extraccion/index.ts) para decidir si hace falta el rescate con IA: sin esta cifra, una
  // extracción PARCIAL es indistinguible de una completa.
  async extraerConDiagnostico(texto: string, bytes?: Uint8Array): Promise<DiagnosticoSena> {
    // El cromo solo se puede reconocer con las páginas separadas. Si no tenemos los bytes (o el PDF
    // no se deja releer), seguimos con el texto ya unido: las limpiezas literales de cada formato
    // son la red de abajo.
    let fuente = texto;
    if (bytes) {
      try {
        fuente = quitarCromoRepetido(await extraerPaginasPdf(bytes));
      } catch (e) {
        console.warn("[extraccion] SenaParser: no se pudo releer el PDF por páginas:", e);
      }
    }

    const esFormatoNuevo =
      /COMPETENCIAS\s+EVAL\s+IH/.test(fuente) &&
      !/REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS/.test(fuente);

    if (esFormatoNuevo) {
      console.log("[extraccion] SenaParser: detectado formato NUEVO (COMPETENCIAS EVAL IH)");
      return this.extraerFormatoNuevo(fuente);
    }
    console.log("[extraccion] SenaParser: usando formato clásico");
    return this.extraerFormatoClasico(fuente);
  }

  // ── Formato NUEVO (2024+) ──
  //
  // Se PARTE por el encabezado de tabla antes de parsear nada: el número de trozos ES el número de
  // filas del documento, y ninguna fila puede comerse a la siguiente porque el corte ya está hecho.
  private extraerFormatoNuevo(texto: string): DiagnosticoSena {
    let txt = quitarCromoVariable(texto.replace(/\s+/g, " ").trim())
      .replace(
        /La autenticidad de este documento puede ser verificada en el registro electr[oó]nico que se encuentra en la p[aá]gina web\s+https?:\/\/\S+/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    // El primer trozo es el preámbulo (datos del estudiante y del programa), no una fila.
    const bloques = txt.split(/COMPETENCIAS\s+EVAL\s+IH\s*/).slice(1);

    // Una fila entera, ANCLADA a los extremos del bloque. Al estar anclada no puede desbordarse
    // hacia la fila vecina: si el bloque viene sucio, el match falla y la fila se reporta.
    //   1 nombre · 2 nota · 3 intensidad horaria · 4 ruido tolerado · 5 resultados de aprendizaje
    // El grupo de RUIDO es la concesión al cromo que se le haya escapado a quitarCromoRepetido; va
    // acotado a 200 caracteres para que no pueda tragarse texto útil, y se registra cuando aparece.
    // La IH pide 2-4 dígitos (las competencias van de 48 a 1008 horas): así un número suelto dentro
    // del nombre no se hace pasar por una intensidad horaria.
    const FILA =
      /^([\s\S]*?)\s+(\d+(?:[.,]\d+)?)\s+(\d{2,4})\s+([\s\S]{0,200}?)RESULTADOS\s+DE\s+APRENDIZAJE\b\s*([\s\S]*)$/;

    const filas: FilaSena[] = [];
    let fallidas = 0;
    let conRuido = 0;

    bloques.forEach((bloque, i) => {
      const m = bloque.match(FILA);
      if (!m) {
        fallidas++;
        console.error(
          `[extraccion] SenaParser: la fila ${i + 1}/${bloques.length} no se pudo leer. Empieza por: ${JSON.stringify(bloque.slice(0, 140))}`,
        );
        return;
      }

      const nombre = quitarPrefijoInstitucional(m[1].replace(/\s+/g, " ").trim());
      if (m[4].trim().length > 0) {
        conRuido++;
        console.warn(
          `[extraccion] SenaParser: ruido descartado dentro de la fila "${nombre.slice(0, 60)}": ${JSON.stringify(m[4].trim().slice(0, 80))}`,
        );
      }

      filas.push({ nombre, nota: m[2], ih: parseInt(m[3], 10), ras: separarResultados(m[5]) });
    });

    if (conRuido > 0) {
      console.warn(
        `[extraccion] SenaParser: ${conRuido} fila(s) traían cromo de página sin limpiar; revisar quitarCromoRepetido si se repite.`,
      );
    }

    // La ETAPA PRÁCTICA no es una competencia: es la etapa productiva del programa. Se descarta
    // aquí (por patrón, no por igualdad exacta de string, que se rompía con un acento o un espacio
    // de más) pero se CUENTA como fila leída: no es una pérdida, es una exclusión deliberada.
    const utiles = filas.filter((f) => !/^RESULTADOS\s+DE\s+APRENDIZAJE\s+ETAPA\s+PR[AÁ]CTICA/i.test(f.nombre));
    const descartadas = filas.length - utiles.length;

    const { filas: fusionadas, fusionadas: cuantasFusionadas } = fusionarFilasRepetidas(utiles);

    console.log(
      `[extraccion] SenaParser (formato nuevo): ${bloques.length} fila(s) en el documento → ` +
        `${fallidas} ilegible(s), ${descartadas} descartada(s) por ser etapa práctica, ` +
        `${cuantasFusionadas} fusionada(s) por salto de página → ${fusionadas.length} competencias.`,
    );

    return {
      unidades: fusionadas.map((f) => construirUnidad(f, "Aprobado")),
      formato: "nuevo",
      esperadas: bloques.length,
      fallidas,
      fusionadas: cuantasFusionadas,
    };
  }

  // ── Formato CLÁSICO (pre-2024) ──
  //
  // Aquí la partición ya era estructural (un marcador por competencia, con su nota y sus horas), y
  // funciona: lo que se añade es la misma reconciliación y la misma fusión que el formato nuevo, más
  // la limpieza de cromo por repetición que corre antes de llegar aquí.
  private extraerFormatoClasico(texto: string): DiagnosticoSena {
    let txt = texto.replace(/\s+/g, " ").trim();

    // Limpieza: encabezados de página y cierre (firma + expedición). Con el cromo ya quitado por
    // repetición estas reglas suelen no encontrar nada; se quedan porque son la única red cuando el
    // parser recibe texto sin los bytes del PDF (y porque el cierre no es cromo: sale una sola vez).
    txt = txt.replace(/Ministerio de Trabajo.*?Página\s+\d+\s+de\s+\d+/gi, " ");
    txt = txt.replace(/\s+(?:[A-ZÁÉÍÓÚÑÜ.]+\s+){1,8}SUBDIRECTOR\s*\(A\).*$/i, " ");
    txt = txt.replace(/Se expide en.*$/i, " ");
    txt = quitarCromoVariable(txt).replace(/\s+/g, " ").trim();

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
      console.warn(
        "[extraccion] SenaParser debug: texto tiene",
        txt.length,
        "chars. REGISTRO:",
        /REGISTRO/i.test(txt),
        "COMPETENCIAS:",
        /COMPETENCIAS/i.test(txt),
      );
      const idxC = txt.indexOf("COMPETENCIAS");
      if (idxC >= 0) {
        console.warn(
          "[extraccion] SenaParser: contexto cerca de COMPETENCIAS:",
          txt.substring(Math.max(0, idxC - 30), idxC + 50),
        );
      }
      return { unidades: [], formato: "clasico", esperadas: 0, fallidas: 0, fusionadas: 0 };
    }

    // Nombres: cola del segmento anterior a cada marcador.
    const nombres: string[] = [];
    for (let k = 0; k < marcas.length; k++) {
      const desde = k === 0 ? 0 : marcas[k - 1].fin;
      const seg = txt.slice(desde, marcas[k].inicio).trim();
      const crudo = k === 0 ? nombrePrimero(seg) : nombreDesdeCola(seg).nombre;
      nombres.push(quitarPrefijoInstitucional(crudo));
    }

    // RAs + armado de filas.
    const filas: FilaSena[] = [];
    const notas: string[] = [];
    let fallidas = 0;

    for (let k = 0; k < marcas.length; k++) {
      const hasta = k + 1 < marcas.length ? marcas[k + 1].inicio : txt.length;
      let seg = txt.slice(marcas[k].fin, hasta).trim();
      // El nombre de la SIGUIENTE competencia cuelga al final de este segmento: se recorta.
      if (k + 1 < marcas.length) {
        const { inicioNombre } = nombreDesdeCola(seg);
        seg = seg.slice(0, inicioNombre).trim();
      }

      // Un marcador SIN nombre legible es una fila que no se supo leer: antes salía como
      // "Competencia 7", un nombre que no significa nada y que el motor no puede emparejar con
      // nada. Se cuenta como fallo para que la reconciliación lo vea.
      if (!nombres[k]) {
        fallidas++;
        console.error(
          `[extraccion] SenaParser: la competencia ${k + 1}/${marcas.length} se quedó sin nombre legible.`,
        );
      }

      filas.push({
        nombre: nombres[k] || `Competencia ${k + 1}`,
        nota: marcas[k].nota,
        ih: marcas[k].ih,
        ras: separarResultados(seg),
      });
      notas.push(
        marcas[k].evaluacion === "A"
          ? "Aprobado"
          : marcas[k].evaluacion === "D"
            ? "No aprobado"
            : marcas[k].evaluacion,
      );
    }

    // La fusión respeta la nota: solo se unen filas con el mismo nombre, y la nota que queda es la
    // de la primera aparición (en el formato clásico las repeticiones traen la misma evaluación).
    const notaPorClave = new Map<string, string>();
    filas.forEach((f, i) => {
      const clave = claveFusion(f.nombre);
      if (!notaPorClave.has(clave)) notaPorClave.set(clave, notas[i]);
    });

    const { filas: fusionadas, fusionadas: cuantasFusionadas } = fusionarFilasRepetidas(filas);

    console.log(
      `[extraccion] SenaParser (formato clásico): ${marcas.length} competencia(s) en el documento → ` +
        `${fallidas} sin nombre legible, ${cuantasFusionadas} fusionada(s) → ${fusionadas.length} competencias.`,
    );

    return {
      unidades: fusionadas.map((f) =>
        construirUnidad(f, notaPorClave.get(claveFusion(f.nombre)) ?? "Aprobado"),
      ),
      formato: "clasico",
      esperadas: marcas.length,
      fallidas,
      fusionadas: cuantasFusionadas,
    };
  }
}
