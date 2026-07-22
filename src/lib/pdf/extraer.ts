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
