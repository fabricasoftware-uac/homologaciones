import { extractText, getDocumentProxy } from "unpdf";

// Extrae el texto de un PDF en memoria. Hoy lo usa la validación con IA (decidir si el archivo es
// un certificado académico real); más adelante alimentará también la extracción de materias de
// origen (Fase 4).
//
// unpdf trae una build de pdf.js lista para entornos serverless/Node, sin dependencias nativas, así
// que corre dentro de las Server Actions de Next sin configuración extra.
export async function extraerTextoPdf(datos: Uint8Array): Promise<string> {
  // Trabajamos sobre una COPIA: getDocumentProxy "desliga" (detach) el ArrayBuffer que recibe, y
  // quien nos llama puede necesitar los bytes después (p. ej. el fallback de OCR por visión cuando el
  // PDF no trae texto). Slicing aquí deja el `datos` original intacto.
  const pdf = await getDocumentProxy(datos.slice());
  // mergePages une el texto de todas las páginas en un solo string.
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

// Mismo texto, pero SIN unir las páginas. Lo pide el SenaParser: los encabezados y pies de página
// solo se pueden reconocer por REPETICIÓN entre páginas, y una vez unido el texto esa frontera se
// pierde para siempre. Ver quitarCromoRepetido en src/lib/extraccion/sena-parser.ts.
export async function extraerPaginasPdf(datos: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(datos.slice());
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

// ── Renglones con coordenadas ──
//
// El texto plano de un PDF viene en el orden del content-stream, que NO es el orden visual: en un
// reporte tabular las celdas salen revueltas y los datos de una fila se mezclan con los de la
// siguiente (p. ej. el número de fila pegado al nombre de la materia, o los créditos pegados al
// periodo). Para leer TABLAS hay que reconstruir los renglones por posición.
//
// Esto es lo que usa el SeguimientoPensumParser. La reconstrucción de PENSUMS (cuadrículas de varias
// columnas) vive aparte, en src/lib/pdf/extraer-estructurado.ts: allí el objetivo es producir TEXTO
// ordenado para la IA; aquí se devuelven los fragmentos crudos para que un parser los lea por celda.
export type FragmentoPdf = { texto: string; x: number; y: number; ancho: number };
export type RenglonPdf = { pagina: number; y: number; fragmentos: FragmentoPdf[] };

// Distancia vertical máxima (en puntos) para considerar que dos fragmentos están en el mismo renglón.
const TOLERANCIA_RENGLON = 3;

export async function extraerRenglonesPdf(datos: Uint8Array): Promise<RenglonPdf[]> {
  const pdf = await getDocumentProxy(datos.slice());
  const renglones: RenglonPdf[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const contenido = await pagina.getTextContent();

    const fragmentos: FragmentoPdf[] = [];
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

    // El eje y del PDF crece hacia ARRIBA: orden descendente = de arriba hacia abajo.
    fragmentos.sort((a, b) => b.y - a.y);

    for (const f of fragmentos) {
      const actual = renglones[renglones.length - 1];
      if (actual && actual.pagina === p && Math.abs(actual.y - f.y) <= TOLERANCIA_RENGLON) {
        actual.fragmentos.push(f);
      } else {
        renglones.push({ pagina: p, y: f.y, fragmentos: [f] });
      }
    }
  }

  // Dentro del renglón, de izquierda a derecha: ese ES el orden de las columnas.
  for (const r of renglones) r.fragmentos.sort((a, b) => a.x - b.x);

  return renglones;
}
