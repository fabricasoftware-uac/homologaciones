import { extraerRenglonesPdf, type RenglonPdf } from "@/lib/pdf/extraer";

import { notaANumero, NOTA_MINIMA_APROBACION } from "./escala-nota";
import type { MateriaExtraida, Extractor } from "./tipos";

// Parser determinístico (0 tokens) para el reporte "SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE", el
// formato que emiten los sistemas académicos que mandan la mayoría de las solicitudes que NO son del
// SENA. Verificado contra un reporte real de Ingeniería Civil (ago-2026, 3 páginas, 60 filas).
//
// ── CÓMO ES EL DOCUMENTO ──
//
//   CURSOS PENSUM                       |  CURSOS VISTOS
//   No Cod_Curso Nombre_Curso        CR |  Cod_Curso Nombre_Curso   Jornada Grupo --Nota-- Repit Año/P
//   1  19051308  CATEDRA AUTONOMA    2  |  19051308  CATEDRA AUTONOMA NOCTURNO  A     4.3        2023/P001
//   6  36220208  INTRO. PROGRAMACION 3  |  ********  **************** ********  ***** *****      *******
//
// El reporte lista el PLAN COMPLETO de la carrera y RELLENA CON ASTERISCOS lo que el estudiante no
// ha cursado. En el documento de referencia, de 60 filas el estudiante solo cursó 6.
//
// ── POR QUÉ EXISTE (lo que pasaba cuando este formato lo leía el ParserIA) ──
//
//  1. Llegaban al panel las ~60 materias del plan, casi todas SIN NOTA, y el asesor tenía que
//     descartar a mano una por una lo que el estudiante nunca cursó.
//  2. La NOTA no llegaba. Es el dato con el que se decide (nota mínima de homologación): sin ella el
//     asesor tenía que abrir el PDF y buscar materia por materia.
//  3. El relleno de asteriscos (5166 en el documento de referencia) hunde la proporción de letras al
//     36%: el Quality Gate daba el texto por NO USABLE y mandaba el caso a OCR por visión —tres
//     llamadas de visión, decenas de segundos— para leer un PDF con capa de texto perfecta.
//
// ── POR QUÉ POR COORDENADAS Y NO POR TEXTO ──
//
// En el orden del content-stream las celdas salen revueltas: la misma fila de arriba se extrae como
// "19051308 CATEDRA AUTONOMA1 19051308 CATEDRA AUTONOMA NOCTURNO A 4.3 2023/P0012" — el número de
// fila pegado al nombre y los créditos pegados al periodo. Reconstruyendo los renglones por posición
// (extraerRenglonesPdf) cada celda vuelve a su columna y la lectura es exacta.
//
// ── LA REGLA QUE MANDA AQUÍ ──
//
// Una fila SIN NOTA no es una materia: es una casilla del plan que el estudiante no ha cursado. No
// se extrae. Y una fila que SÍ se cursó pero que el parser no supo leer no puede desaparecer en
// silencio: se cuenta (sinNota) para que el orquestador pueda decidir el rescate con IA.
//
// Las REPROBADAS sí salen de aquí: filtrarlas es política (`notas.ts`), no lectura, y además este
// parser las necesita para cuadrar los créditos aprobados contra los que declara el propio reporte.

const TITULO = "SEGUIMIENTOPENSUMGENERALPORESTUDIANTE";

// Comparación robusta de rótulos: sin tildes, sin espacios y en mayúsculas. Los espacios sobran
// porque la fuente del reporte los mete donde no van ("Nom bre", "PRIM ER SEM ESTRE", "Prom .
// Académ ico"): compactando, esos rótulos vuelven a ser reconocibles.
const compactar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .toUpperCase();

const textoDe = (renglon: RenglonPdf) => renglon.fragmentos.map((f) => f.texto).join(" ");

// Celda vacía del reporte: una corrida de asteriscos (o de guiones/puntos, según el generador).
const RELLENO = /^[*.\-_]{2,}$/;

// Código institucional del curso: alfanumérico sin espacios y con dígitos de sobra ("36220101",
// "TGRADO3622"). Pide 4+ dígitos para que un "DIURNO" o un grupo no se hagan pasar por código.
const CODIGO = /^(?=(?:[^\d]*\d){4})[A-Z0-9]{5,14}$/;

// Número de fila y créditos: enteros sueltos de 1-2 dígitos.
const ENTERO = /^\d{1,3}$/;

// La NOTA es el único número DECIMAL de la fila (los créditos, el número de fila y el año son
// enteros). La letra final opcional es la marca que el reporte cuelga de algunas notas ("1.6H").
const NOTA = /^\d{1,3}[.,]\d{1,2}\s?[A-Z]?$/;

// Palabras que cierran el nombre de la materia. Sirven de tope cuando la fila viene sin créditos
// (cursos fuera del plan): sin esto el nombre se comería la jornada y el grupo.
const JORNADA = /^(DIURN[AO]|NOCTURN[AO]|SABATIN[AO]|DOMINICAL|VIRTUAL|DISTANCIA|MIXT[AO]|ESPECIAL)$/;

const ORDINALES: Record<string, number> = {
  PRIMER: 1,
  PRIMERO: 1,
  SEGUNDO: 2,
  TERCER: 3,
  TERCERO: 3,
  CUARTO: 4,
  QUINTO: 5,
  SEXTO: 6,
  SEPTIMO: 7,
  OCTAVO: 8,
  NOVENO: 9,
  DECIMO: 10,
  UNDECIMO: 11,
  DECIMOPRIMERO: 11,
  DUODECIMO: 12,
  DECIMOSEGUNDO: 12,
};

const esBanner = (renglon: RenglonPdf) => {
  const c = compactar(textoDe(renglon));
  return c.includes("CURSOSPENSUM") || c.includes("CURSOSVISTOS");
};

// Encabezado de la tabla: es el renglón que nombra las columnas. Marca dónde empiezan los datos.
const esEncabezadoTabla = (renglon: RenglonPdf) => {
  const c = compactar(textoDe(renglon));
  return c.includes("COD_CURSO") && c.includes("NOMBRE_CURSO") && c.includes("NOTA");
};

// "PRIM ER SEM ESTRE" -> 1. Las secciones que no son un semestre (TRABAJO DE GRADO, REQUISITO DE
// GRADO, SUFICIENCIA SEGUNDA LENGUA) devuelven null: sus materias van sin semestre de origen.
function semestreDeSeccion(renglon: RenglonPdf): number | null {
  const c = compactar(textoDe(renglon));
  if (!c.endsWith("SEMESTRE")) return null;
  return ORDINALES[c.slice(0, -"SEMESTRE".length)] ?? null;
}

type FilaSeguimiento = {
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  nota: string | null;
  /** Semestre de la sección del plan en la que está la fila. Null en TRABAJO DE GRADO y similares. */
  semestre: number | null;
  /** El lado "CURSOS VISTOS" trae datos reales (no es puro relleno): el estudiante SÍ cursó la materia. */
  cursada: boolean;
};

const esTexto = (token: string) =>
  /\p{L}{2,}/u.test(token) && !CODIGO.test(token) && !NOTA.test(token) && !JORNADA.test(token);

// Lee una fila de datos celda por celda, de izquierda a derecha. Devuelve null si el renglón no
// tiene forma de fila (código + nombre): así los renglones de preámbulo que se repiten en cada
// página —"Nom bre Estudiante: ...", "Prom . Académ ico: 2,9"— no se cuelan como materias. Ese
// "2,9" es justamente lo que haría el mayor daño: parece una nota.
function parsearFila(renglon: RenglonPdf, semestre: number | null): FilaSeguimiento | null {
  const tokens = renglon.fragmentos
    .map((f) => f.texto.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0 && !RELLENO.test(t));

  let i = 0;
  // (1) Número de orden dentro del semestre. No aporta nada, pero hay que consumirlo para no
  // confundirlo con los créditos.
  if (i < tokens.length && ENTERO.test(tokens[i]) && tokens[i + 1] && CODIGO.test(tokens[i + 1])) i++;

  // (2) Código del curso en el plan.
  if (i >= tokens.length || !CODIGO.test(tokens[i])) return null;
  const codigo = tokens[i++];

  // (3) Nombre, hasta el siguiente número o código. Del lado del PLAN viene COMPLETO; el de la
  // columna "cursos vistos" viene recortado por el ancho de la celda ("INTRODUCCION A LA INGENIERIA"
  // en vez de "INTRODUCCION A LA INGENIERIA CIVIL"), así que el bueno es este.
  const partes: string[] = [];
  while (i < tokens.length && esTexto(tokens[i])) partes.push(tokens[i++]);
  const nombre = partes.join(" ").replace(/\s+/g, " ").trim();
  if (!nombre) return null;

  // (4) Créditos del plan.
  let creditos: number | null = null;
  if (i < tokens.length && ENTERO.test(tokens[i])) creditos = parseInt(tokens[i++], 10);

  // (5) Lo que queda es el lado "CURSOS VISTOS". Si está vacío, todo era relleno: la materia no se
  // cursó. Si trae algo, la nota es su único decimal.
  const resto = tokens.slice(i);
  const nota = resto.find((t) => NOTA.test(t)) ?? null;

  return {
    nombre,
    codigo,
    creditos,
    nota: nota?.replace(/\s+/g, "") ?? null,
    semestre,
    cursada: resto.length > 0,
  };
}

// Una materia repetida (o vista dos veces con distinta nota) no puede entrar dos veces al panel:
// serían dos tarjetas de origen compitiendo por la misma asignatura destino. Se queda la mejor nota.
function fusionarRepetidas(filas: FilaSeguimiento[]): { filas: FilaSeguimiento[]; fusionadas: number } {
  const porClave = new Map<string, FilaSeguimiento>();
  let fusionadas = 0;

  for (const fila of filas) {
    const clave = fila.codigo ?? compactar(fila.nombre);
    const previa = porClave.get(clave);
    if (!previa) {
      porClave.set(clave, fila);
      continue;
    }
    fusionadas++;
    if ((notaANumero(fila.nota) ?? -1) > (notaANumero(previa.nota) ?? -1)) {
      porClave.set(clave, { ...fila, creditos: fila.creditos ?? previa.creditos });
    }
  }

  return { filas: [...porClave.values()], fusionadas };
}

// El propio reporte trae la cifra con la que contrastar la lectura: "Total Créditos Aprobados: 10".
// No decide nada (el mínimo de aprobación lo fija cada institución y aquí se asume 3.0), pero deja
// en el log una señal clara de si las notas se leyeron bien.
function reconciliarCreditosAprobados(renglones: RenglonPdf[], filas: FilaSeguimiento[]): void {
  const renglon = renglones.find((r) => compactar(textoDe(r)).includes("TOTALCREDITOSAPROBADOS"));
  if (!renglon) return;

  const declarado = textoDe(renglon).match(/Aprobados?\s*:?\s*(\d+)/i);
  if (!declarado) return;

  const leido = filas.reduce((suma, f) => {
    const n = notaANumero(f.nota);
    return n != null && n >= NOTA_MINIMA_APROBACION && f.creditos != null ? suma + f.creditos : suma;
  }, 0);

  const esperado = parseInt(declarado[1], 10);
  if (leido === esperado) {
    console.log(
      `[extraccion] SeguimientoPensumParser: créditos aprobados leídos (${leido}) = los que declara el reporte.`,
    );
  } else {
    console.warn(
      `[extraccion] SeguimientoPensumParser: los créditos aprobados leídos (${leido}) NO cuadran con los que declara el reporte (${esperado}). Revisar la lectura de notas o el mínimo de aprobación de la institución.`,
    );
  }
}

export type DiagnosticoSeguimiento = {
  /** Si el documento ES este formato. Cuando es false, el llamador debe seguir con el ParserIA. */
  detectado: boolean;
  unidades: MateriaExtraida[];
  /** Filas de datos leídas bajo las tablas (todo el plan, cursado o no). */
  filas: number;
  /** Filas cuyo lado "cursos vistos" trae datos reales. */
  cursadas: number;
  /** Filas cursadas a las que NO se les pudo leer la nota: el síntoma de una lectura rota. */
  sinNota: number;
};

// Fábrica, no constante: cada llamada devuelve su propio objeto (y su propio array) para que nadie
// pueda mutar de rebote el resultado de otra extracción.
const noEsEsteFormato = (): DiagnosticoSeguimiento => ({
  detectado: false,
  unidades: [],
  filas: 0,
  cursadas: 0,
  sinNota: 0,
});

export class SeguimientoPensumParser implements Extractor {
  readonly nombre = "SeguimientoPensumParser";

  async extraer(texto: string, bytes?: Uint8Array): Promise<MateriaExtraida[]> {
    return (await this.extraerConDiagnostico(texto, bytes)).unidades;
  }

  async extraerConDiagnostico(texto: string, bytes?: Uint8Array): Promise<DiagnosticoSeguimiento> {
    // Sin los bytes no hay coordenadas, y sin coordenadas este formato no se puede leer bien. Se
    // avisa (para que no parezca que el formato no se reconoció) y se deja pasar al ParserIA.
    if (!bytes) {
      if (compactar(texto).includes(TITULO)) {
        console.warn(
          "[extraccion] SeguimientoPensumParser: el documento es de este formato pero llegó sin los bytes del PDF; se deja al ParserIA.",
        );
      }
      return noEsEsteFormato();
    }

    let renglones: RenglonPdf[];
    try {
      renglones = await extraerRenglonesPdf(bytes);
    } catch (e) {
      console.warn("[extraccion] SeguimientoPensumParser: no se pudo leer el PDF por coordenadas:", e);
      return noEsEsteFormato();
    }

    const hayTitulo = renglones.some((r) => compactar(textoDe(r)).includes(TITULO));
    const hayTabla = renglones.some(esEncabezadoTabla);
    if (!hayTitulo || !hayTabla) return noEsEsteFormato();

    console.log("[extraccion] SeguimientoPensumParser: detectado reporte de seguimiento de pensum.");

    const filas: FilaSeguimiento[] = [];

    // Estructura del documento, sección por sección:
    //   CURSOS PENSUM / CURSOS VISTOS   <- banner: empieza una sección
    //   PRIM ER SEM ESTRE               <- título de la sección (o "TRABAJO DE GRADO", sin semestre)
    //   No Cod_Curso ... ----Nota----   <- encabezado de tabla: a partir de aquí, datos
    //   1 19051308 CATEDRA ...          <- filas
    // La tabla termina cuando un renglón deja de tener forma de fila: el banner de la sección
    // siguiente, o el preámbulo que el reporte repite en cada página.
    let seccion: number | null = null;
    let esperandoTitulo = false;
    let enTabla = false;

    for (const renglon of renglones) {
      if (esBanner(renglon)) {
        seccion = null;
        esperandoTitulo = true;
        enTabla = false;
        continue;
      }

      if (esEncabezadoTabla(renglon)) {
        esperandoTitulo = false;
        enTabla = true;
        continue;
      }

      if (esperandoTitulo) {
        seccion = semestreDeSeccion(renglon);
        esperandoTitulo = false;
        continue;
      }

      if (!enTabla) continue;

      const fila = parsearFila(renglon, seccion);
      if (!fila) {
        enTabla = false;
        continue;
      }
      filas.push(fila);
    }

    const cursadas = filas.filter((f) => f.cursada);
    const conNota = cursadas.filter((f) => f.nota !== null);

    const { filas: unicas, fusionadas } = fusionarRepetidas(conNota);

    console.log(
      `[extraccion] SeguimientoPensumParser: ${filas.length} fila(s) del plan → ` +
        `${cursadas.length} cursada(s), ${cursadas.length - conNota.length} sin nota legible, ` +
        `${fusionadas} repetida(s) fusionada(s) → ${unicas.length} materias con nota.`,
    );
    reconciliarCreditosAprobados(renglones, unicas);

    return {
      detectado: true,
      unidades: unicas.map((f) => ({
        nombre: f.nombre,
        codigo: f.codigo,
        creditos: f.creditos,
        nota: f.nota,
        semestre_origen: f.semestre,
        tipo: "materia",
      })),
      filas: filas.length,
      cursadas: cursadas.length,
      sinNota: cursadas.length - conNota.length,
    };
  }
}
