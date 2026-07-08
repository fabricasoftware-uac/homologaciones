import { getDocumentProxy } from "unpdf";

// Extracción de texto CON LAYOUT para PDFs de pensum. El problema que resuelve: los planes de
// estudio suelen ser CUADRÍCULAS (una columna por semestre) y extractText(mergePages) devuelve los
// items en el orden del content-stream del PDF, no en orden visual: los créditos quedan separados de
// los nombres y los límites de semestre se pierden. Aquí reconstruimos el orden visual usando las
// coordenadas de cada item (pdf.js: transform[4]=x, transform[5]=y) y detectamos columnas, para que
// la IA reciba el plan ordenado columna por columna (= semestre por semestre).
//
// Todo es determinístico: 0 tokens, 0 llamadas a IA.

type Fragmento = { texto: string; x: number; y: number; ancho: number };

// Distancia vertical máxima (en unidades de PDF, ~puntos) para considerar que dos items están en el
// mismo renglón visual.
const TOLERANCIA_RENGLON = 3;

// Separación horizontal mínima entre bandas para considerarlas columnas distintas. Menor que esto,
// se fusionan (p. ej. el nombre y su crédito dentro de la misma columna de semestre).
const SEPARACION_COLUMNAS = 18;

// Un hueco horizontal mayor a esto dentro de un renglón se marca con " | " para conservar la
// separación visual de celdas (ayuda a la IA a no pegar el crédito de una materia con el nombre de
// la siguiente).
const HUECO_CELDA = 14;

type Banda = { inicio: number; fin: number; fragmentos: Fragmento[] };

// Fusiona los intervalos horizontales [x, x+ancho] de los fragmentos en bandas (columnas visuales),
// permitiendo huecos menores a SEPARACION_COLUMNAS.
function detectarBandas(fragmentos: Fragmento[]): Banda[] {
  const ordenados = [...fragmentos].sort((a, b) => a.x - b.x);
  const bandas: Banda[] = [];
  for (const f of ordenados) {
    const ultima = bandas[bandas.length - 1];
    if (ultima && f.x <= ultima.fin + SEPARACION_COLUMNAS) {
      ultima.fin = Math.max(ultima.fin, f.x + f.ancho);
      ultima.fragmentos.push(f);
    } else {
      bandas.push({ inicio: f.x, fin: f.x + f.ancho, fragmentos: [f] });
    }
  }
  return bandas;
}

// Una banda es "de texto" si contiene suficientes items con palabras reales (nombres de asignaturas),
// no solo números sueltos (créditos) o encabezados cortos.
function esBandaDeTexto(banda: Banda): boolean {
  const conPalabras = banda.fragmentos.filter((f) => /[a-záéíóúñü]{4,}/i.test(f.texto));
  return conPalabras.length >= 3;
}

// Agrupa fragmentos en renglones visuales por su y (el eje y del PDF crece hacia ARRIBA: orden
// descendente = de arriba hacia abajo) y une cada renglón de izquierda a derecha, marcando con " | "
// los saltos de celda.
function aRenglones(fragmentos: Fragmento[]): string[] {
  const ordenados = [...fragmentos].sort((a, b) => b.y - a.y || a.x - b.x);
  const renglones: Fragmento[][] = [];
  for (const f of ordenados) {
    const actual = renglones[renglones.length - 1];
    if (actual && Math.abs(actual[0].y - f.y) <= TOLERANCIA_RENGLON) {
      actual.push(f);
    } else {
      renglones.push([f]);
    }
  }
  return renglones.map((renglon) => {
    const porX = renglon.sort((a, b) => a.x - b.x);
    let linea = "";
    let finPrevio: number | null = null;
    for (const f of porX) {
      if (finPrevio !== null) {
        linea += f.x - finPrevio > HUECO_CELDA ? " | " : " ";
      }
      linea += f.texto;
      finPrevio = f.x + f.ancho;
    }
    return linea;
  });
}

// Reconstruye el texto de una página. Si detecta 3+ columnas con texto real (cuadrícula de
// semestres), emite columna por columna; si no, emite los renglones de la página completa (esto ya
// corrige el orden revuelto del content-stream y mantiene cada nombre junto a su crédito).
function reconstruirPagina(fragmentos: Fragmento[], numeroPagina: number): string {
  if (fragmentos.length === 0) return "";

  const bandas = detectarBandas(fragmentos);
  const bandasDeTexto = bandas.filter(esBandaDeTexto);

  if (bandasDeTexto.length >= 3) {
    // Cuadrícula: cada columna con texto suele ser un semestre. Los números/encabezados que quedaron
    // en bandas no-texto (p. ej. la fila "1 2 3..." de encabezados) se anexan a su columna más cercana
    // para no perder los rótulos de semestre.
    for (const banda of bandas) {
      if (bandasDeTexto.includes(banda)) continue;
      const centro = (banda.inicio + banda.fin) / 2;
      let destino = bandasDeTexto[0];
      let mejor = Infinity;
      for (const b of bandasDeTexto) {
        const d = Math.abs((b.inicio + b.fin) / 2 - centro);
        if (d < mejor) {
          mejor = d;
          destino = b;
        }
      }
      destino.fragmentos.push(...banda.fragmentos);
    }
    return bandasDeTexto
      .map(
        (banda, i) =>
          `--- COLUMNA ${i + 1} (página ${numeroPagina}) ---\n` + aRenglones(banda.fragmentos).join("\n"),
      )
      .join("\n\n");
  }

  return `--- PÁGINA ${numeroPagina} ---\n` + aRenglones(fragmentos).join("\n");
}

export type TextoEstructurado = { texto: string; totalPaginas: number };

// Extrae el texto de un PDF reconstruyendo el orden visual (renglones y columnas) a partir de las
// coordenadas. Si el PDF no tiene capa de texto (escaneado), `texto` queda vacío o casi vacío y el
// llamador debe ir por visión.
export async function extraerTextoEstructurado(datos: Uint8Array): Promise<TextoEstructurado> {
  // Copia: getDocumentProxy desliga el ArrayBuffer y el llamador puede necesitar los bytes después.
  const pdf = await getDocumentProxy(datos.slice());
  const totalPaginas = pdf.numPages;

  const paginas: string[] = [];
  for (let p = 1; p <= totalPaginas; p++) {
    const pagina = await pdf.getPage(p);
    const contenido = await pagina.getTextContent();
    const fragmentos: Fragmento[] = [];
    for (const item of contenido.items) {
      if (!("str" in item)) continue;
      const texto = item.str.trim();
      if (!texto) continue;
      fragmentos.push({
        texto,
        x: item.transform[4],
        y: item.transform[5],
        ancho: item.width || texto.length * 4,
      });
    }
    const reconstruida = reconstruirPagina(fragmentos, p);
    if (reconstruida) paginas.push(reconstruida);
  }

  return { texto: paginas.join("\n\n"), totalPaginas };
}
