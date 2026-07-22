import { getDocumentProxy } from "unpdf";

export type AsignaturaExtraida = {
  nombre: string;
  codigo: string | null;
  creditos: number;
  semestre: number;
};

const ROMANOS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

function romanoANumero(romano: string): number | null {
  return ROMANOS[romano.toLowerCase()] ?? null;
}

type Item = { x: number; y: number; str: string };

// Parser determinístico (0 tokens de IA) para el formato institucional de pensum en cuadrícula:
// bloques "CURSO | CR" por semestre, marcador "Semestre N" (romano) al pie de cada bloque, en una
// o dos columnas por página. Es un FAST-PATH: las posiciones de las columnas se INFIEREN de los
// encabezados CURSO/CR de cada página (cada carrera exporta el PDF con X distintas), y al final la
// salida se auto-valida; si el layout no calza o la salida huele a basura (nombres concatenados,
// bloques vacíos), devuelve [] y el llamador cae a la extracción por IA. Preferimos no responder
// a responder datos plausibles pero corruptos.
export async function parsearPensum(bytes: Uint8Array): Promise<AsignaturaExtraida[]> {
  const pdf = await getDocumentProxy(bytes.slice());

  // Cada página se procesa POR SEPARADO: las Y son coordenadas de página, así que mezclar páginas
  // hace que el texto de una (p. ej. la introducción del programa) caiga "dentro" de los bloques de
  // la cuadrícula de otra. Las páginas sin marcadores de semestre no aportan nada y quedan fuera.
  const resultado: AsignaturaExtraida[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), str: it.str.trim() });
    }
    items.sort((a, b) => b.y - a.y);

    unirFragmentosDeRenglon(items);
    const pagina = parsearPagina(items);
    if (pagina === null) {
      // Un bloque de semestre sin materias = el layout no es el esperado. No nos fiamos de NADA
      // de este documento: mejor que la IA lo lea completo a mezclar mitades de dos métodos.
      console.warn(`[pensum-parser] Página ${p}: layout no reconocido; se descarta el parseo determinístico.`);
      return [];
    }
    resultado.push(...pagina);
  }

  const vistas = new Set<string>();
  const unicas = resultado.filter((a) => {
    const clave = `${a.nombre.toLowerCase()}|${a.semestre}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  if (unicas.length > 0 && !esParseoCoherente(unicas)) {
    console.warn("[pensum-parser] Salida incoherente (nombres concatenados o muy pocos datos); se descarta.");
    return [];
  }
  return unicas;
}

// Auto-validación: señales de que el parseo posicional produjo basura verosímil.
//   - Muy pocas asignaturas/semestres para ser un plan de estudios completo.
//   - Nombres CONCATENADOS: un nombre que empieza con OTRO nombre completo + espacio delata una
//     capa de texto fantasma (algunos PDFs renderizan la lista de un semestre DOS veces, corrida
//     unos px, y las filas se funden con las del semestre siguiente). Un caso suelto puede ser un
//     nombre real ("Derecho Procesal Civil Especial" contiene "Derecho Procesal Civil"); dos o más
//     ya no es casualidad.
//   - FRAGMENTOS: un nombre que empieza en minúscula ("de Conflictos") o con paréntesis sin abrir
//     ("Administrativo Colombiano)") es la mitad huérfana de un nombre multi-línea mal emparejado.
//     Pasa en pensums con nombres largos que parten en 2-3 renglones (Derecho).
function esParseoCoherente(lista: AsignaturaExtraida[]): boolean {
  if (lista.length < 10) return false;
  if (new Set(lista.map((a) => a.semestre)).size < 3) return false;

  const nombres = lista.map((a) => a.nombre.toLowerCase());
  let concatenados = 0;
  for (const n of nombres) {
    if (nombres.some((otro) => n !== otro && n.startsWith(`${otro} `))) concatenados++;
  }
  if (concatenados >= 2) return false;

  let fragmentos = 0;
  for (const a of lista) {
    // Un nombre real empieza en mayúscula o dígito; "de Conflictos" o "(Contratacion Estatal)"
    // sueltos son mitades huérfanas de un nombre partido en renglones.
    const empiezaRaro = !/^[A-ZÁÉÍÓÚÜÑ0-9]/.test(a.nombre);
    const abre = (a.nombre.match(/\(/g) ?? []).length;
    const cierra = (a.nombre.match(/\)/g) ?? []).length;
    if (empiezaRaro || abre !== cierra) fragmentos++;
  }
  return fragmentos < 2;
}

// Algunos PDFs parten una palabra en varios items del mismo renglón ("Prá" + "c" + "tica Profesional")
// por cambios de glifo. Se fusionan IN PLACE: mismo renglón (±2px) y hueco horizontal proporcional al
// largo del texto anterior (~4-8px por carácter). Un hueco de celda (nombre→crédito, columna→columna)
// mide decenas de px de más y no se fusiona; y dos textos SUPERPUESTOS (capa fantasma, hueco ~0 con
// texto largo) tampoco.
function unirFragmentosDeRenglon(items: Item[]): void {
  for (let i = 0; i < items.length; i++) {
    const base = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const sig = items[j];
      if (Math.abs(sig.y - base.y) > 2) continue;
      // Solo fragmentos CORTOS ("Prá" + "c" + "tica…"): el hueco debe ser proporcional al texto
      // anterior Y menor a 60px. Sin el tope, un nombre largo de la columna izquierda "alcanzaba"
      // al de la derecha en el mismo renglón y los fundía.
      const hueco = sig.x - base.x;
      if (hueco < base.str.length * 3 || hueco > Math.min(base.str.length * 8 + 12, 60)) continue;
      base.str = base.str + sig.str;
      items.splice(j, 1);
      j = i; // el fusionado puede continuar con otro fragmento más a la derecha
    }
  }
}

// Agrupa valores de X en clusters (los encabezados de una misma columna varían ±2px entre bloques;
// entre columnas hay decenas de px). Devuelve el centro de cada cluster, de izquierda a derecha.
function clustersX(xs: number[], separacion = 40): number[] {
  const orden = [...xs].sort((a, b) => a - b);
  const centros: number[] = [];
  let grupo: number[] = [];
  for (const x of orden) {
    if (grupo.length > 0 && x - grupo[grupo.length - 1] > separacion) {
      centros.push(grupo.reduce((s, v) => s + v, 0) / grupo.length);
      grupo = [];
    }
    grupo.push(x);
  }
  if (grupo.length > 0) centros.push(grupo.reduce((s, v) => s + v, 0) / grupo.length);
  return centros;
}

// Parsea una página de la cuadrícula. Devuelve null si el layout no se reconoce (algún bloque de
// semestre quedó sin materias, o faltan los encabezados CURSO/CR para inferir las columnas).
function parsearPagina(items: Item[]): AsignaturaExtraida[] | null {
  // 1. Marcadores de semestre.
  const marcadoresCrudos: { semestre: number; x: number; y: number }[] = [];
  for (const it of items) {
    const m = it.str.match(/^Semestre\s+(.+)$/i);
    if (!m) continue;
    const num = romanoANumero(m[1]);
    if (num === null) continue;
    marcadoresCrudos.push({ semestre: num, x: it.x, y: it.y });
  }
  if (marcadoresCrudos.length === 0) return []; // página sin cuadrícula (portada, intro): no aporta

  // 2. Posiciones de las columnas, inferidas de los encabezados CURSO (nombres) y CR (créditos).
  const cursoX = clustersX(items.filter((it) => it.str === "CURSO").map((it) => it.x));
  const crX = clustersX(items.filter((it) => it.str === "CR").map((it) => it.x));
  if (cursoX.length === 0 || crX.length === 0 || cursoX.length !== crX.length) return null;
  if (cursoX.length > 2) return null; // más de dos columnas: formato desconocido

  // Frontera entre columnas: punto medio entre el fin de la izquierda (su CR) y el inicio de la
  // derecha (su CURSO). Con una sola columna no hay frontera.
  const dosColumnas = cursoX.length === 2;
  const frontera = dosColumnas ? (crX[0] + cursoX[1]) / 2 : Infinity;
  const columnaDe = (x: number): 0 | 1 => (dosColumnas && x >= frontera ? 1 : 0);

  const marcadores = marcadoresCrudos
    .map((m) => ({ ...m, columna: columnaDe(m.x) }))
    .sort((a, b) => b.y - a.y); // de arriba hacia abajo, para que `usados` reclame en orden visual

  // Items ya consumidos por un bloque. Los bloques se recorren de arriba hacia abajo y sus rangos
  // se solapan 40px (el marcador queda un pelo por encima de la última fila): sin esto, una fila
  // fronteriza (p. ej. la segunda línea de un nombre partido) se captura en DOS semestres.
  const usados = new Set<Item>();

  // Filas de nombre del bloque ANTERIOR de cada columna. Algunos PDFs renderizan una capa FANTASMA:
  // la lista de un semestre aparece OTRA VEZ, corrida unos px, intercalada con las filas del semestre
  // siguiente. Un nombre idéntico al del bloque de arriba es esa capa, no una materia repetida.
  const nombresPrevios: (Set<string> | null)[] = [null, null];

  const resultado: AsignaturaExtraida[] = [];

  for (let k = 0; k < marcadores.length; k++) {
    const actual = marcadores[k];
    const nombreX = cursoX[actual.columna];
    const creditoX = crX[actual.columna];

    // Las materias de un semestre están POR ENCIMA de su marcador (Y mayor): el marcador
    // "Semestre X" cierra su bloque al pie.
    const nombres: { nombre: string; y: number }[] = [];
    const creditos: { cr: number; y: number }[] = [];

    // Techo del bloque: el marcador del semestre ANTERIOR en la misma columna.
    let yDesde = 9999;
    for (let j = k - 1; j >= 0; j--) {
      if (marcadores[j].columna === actual.columna) { yDesde = marcadores[j].y; break; }
    }

    // Primer bloque de la columna: sin marcador anterior, el techo es el encabezado "CURSO" de su
    // propio bloque. Sin este tope, el texto introductorio de la página (que cae en la misma X que
    // los nombres) se pega a las materias del primer semestre.
    if (yDesde === 9999) {
      const encabezado = items
        .filter((it) => it.str === "CURSO" && it.y > actual.y && columnaDe(it.x) === actual.columna)
        .sort((a, b) => a.y - b.y)[0];
      if (encabezado) yDesde = encabezado.y;
    }

    const candidatosNombre: Item[] = [];
    for (const it of items) {
      if (usados.has(it)) continue;
      if (it.y >= yDesde) continue;
      // El marcador está ligeramente por encima de la última fila del bloque (≤6px en los PDFs
      // reales). La tolerancia era 40px y cada bloque se ROBABA la primera fila del siguiente
      // cuando los bloques van apretados (la fila de arriba del bloque de abajo quedaba a ~38px).
      if (it.y < actual.y - 12) continue;

      if (it.str.match(/^Semestre\s/i)) continue;
      if (it.str === "CURSO" || it.str === "CR") continue;
      if (columnaDe(it.x) !== actual.columna) continue;

      if (Math.abs(it.x - creditoX) <= 12 && /^\d+$/.test(it.str)) {
        creditos.push({ cr: parseInt(it.str, 10), y: it.y });
        usados.add(it);
      } else if (Math.abs(it.x - nombreX) <= 12) {
        candidatosNombre.push(it);
        usados.add(it);
      }
    }

    // Capa fantasma: si VARIAS filas de este bloque son copia exacta de filas del bloque de arriba,
    // el PDF renderizó aquella lista otra vez (corrida unos px) encima de esta. Se descartan las
    // copias. Con una sola coincidencia NO: puede ser un nombre legítimo que comparte texto (p. ej.
    // "Práctica Profesional Deportes" en dos semestres distintos con sufijos partidos en renglones).
    const previos = nombresPrevios[actual.columna];
    const repetidas = previos ? candidatosNombre.filter((it) => previos.has(it.str)).length : 0;
    for (const it of candidatosNombre) {
      if (repetidas >= 3 && previos?.has(it.str)) continue;
      nombres.push({ nombre: it.str, y: it.y });
    }
    nombresPrevios[actual.columna] = new Set(nombres.map((n) => n.nombre));

    // Ordenar por Y descendente (las filas de arriba primero).
    nombres.sort((a, b) => b.y - a.y);
    creditos.sort((a, b) => b.y - a.y);

    // 4. Emparejar nombres y créditos por orden de Y. Si una fila de nombre está muy cerca de la
    //    anterior y no tiene crédito propio, es continuación de un nombre multi-línea.
    const asignaturas: { nombre: string; creditos: number }[] = [];
    let nombrePendiente = "";

    let ci = 0;
    for (let ni = 0; ni < nombres.length; ni++) {
      const n = nombres[ni];

      // Buscar crédito en la misma fila. Tolerancia 7px: en algunos bloques el crédito va ~6px por
      // debajo de su nombre. Es seguro porque nombres y créditos se consumen EN ORDEN (ci avanza):
      // el crédito de la fila siguiente queda a un renglón entero (~9px) y no se confunde.
      let cr = 0;
      if (ci < creditos.length && Math.abs(creditos[ci].y - n.y) <= 7) {
        cr = creditos[ci].cr;
        ci++;
      }

      if (cr > 0) {
        // Esta fila tiene crédito: es una materia independiente.
        if (nombrePendiente) {
          nombrePendiente += " " + n.nombre;
          asignaturas.push({ nombre: nombrePendiente, creditos: cr });
          nombrePendiente = "";
        } else {
          asignaturas.push({ nombre: n.nombre, creditos: cr });
        }
      } else if (ni > 0 && Math.abs(nombres[ni - 1].y - n.y) <= 8) {
        // Sin crédito y muy cerca de la fila anterior: es continuación multi-línea.
        if (nombrePendiente) {
          nombrePendiente += " " + n.nombre;
        } else if (asignaturas.length > 0) {
          // La materia anterior era independiente pero esta fila es su continuación.
          const prev = asignaturas[asignaturas.length - 1];
          prev.nombre += " " + n.nombre;
        } else {
          nombrePendiente = n.nombre;
        }
      } else {
        // Sin crédito y separada: la guardamos como pendiente.
        nombrePendiente = n.nombre;
      }
    }

    // Nombres partidos en dos renglones donde AMBOS traen crédito (la celda del crédito se repite
    // por línea): si un nombre termina en conector ("de", "la", "y", …) es la primera mitad de un
    // nombre multi-línea, no una materia; se une con la siguiente y se conserva un solo crédito.
    const CONECTOR = /\s(de|del|la|las|los|el|y|e|o|u|en|con|para|por|al|a)$/i;
    for (let i = 0; i < asignaturas.length - 1; i++) {
      if (CONECTOR.test(asignaturas[i].nombre)) {
        asignaturas[i].nombre += " " + asignaturas[i + 1].nombre;
        asignaturas.splice(i + 1, 1);
        i--; // el nombre unido podría seguir terminando en conector
      }
    }

    // Un semestre declarado sin materias = el layout nos venció en esta página.
    if (asignaturas.length === 0) return null;

    for (const a of asignaturas) {
      resultado.push({
        nombre: a.nombre.replace(/\s+/g, " ").trim(),
        codigo: null,
        creditos: a.creditos,
        semestre: actual.semestre,
      });
    }
  }

  return resultado;
}
