// Quality Gate del texto extraído (FASE 7 · pieza de robustez).
//
// Que un PDF "tenga capa de texto" no significa que sea USABLE: hay certificados con fuentes sin
// mapa ToUnicode que extraen basura (letras sin sentido), y PDFs-imagen que extraen vacío. Antes el
// único guardián era `length < 30`, que deja pasar gibberish largo → el parser produce datos basura
// EN SILENCIO. Este gate mide señales baratas y determinísticas; si el texto no pasa, el llamador
// decide (típicamente: ir a OCR por visión).

export type CalidadTexto = { usable: boolean; motivo: string };

const MIN_CHARS = 30;

// U+FFFD (carácter de reemplazo), controles C0 (menos tab/salto/retorno) y Área de Uso Privado
// (donde caen los glifos de fuentes sin ToUnicode). Su presencia delata extracción rota. Se construye
// con escapes en string para que el archivo fuente sea 100% ASCII imprimible.
const RE_CORRUPTOS = new RegExp(
  "[\\uFFFD\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uE000-\\uF8FF]",
  "gu",
);

// Relleno de tablas: corridas de asteriscos, guiones o puntos con las que muchos reportes marcan una
// celda VACÍA ("****", "-----", "......"). Es estructura del documento, no extracción rota, pero al
// medir cuenta como "no letra": en un reporte de seguimiento de pensum real son 5166 caracteres que
// hunden la proporción de letras al 36% —por debajo del umbral— y mandaban a OCR por visión un PDF
// con capa de texto perfecta. Se descuenta ANTES de medir.
const RELLENO_TABULAR = /([*.\-_])\1{2,}/g;

export function evaluarCalidadTexto(texto: string): CalidadTexto {
  const t = texto.replace(RELLENO_TABULAR, " ").trim();
  if (t.length < MIN_CHARS) {
    return { usable: false, motivo: `muy corto (${t.length} chars)` };
  }

  const sinEspacios = t.replace(/\s+/g, "");

  // 1. Proporción de LETRAS: un certificado real es mayormente texto. El gibberish típico de fuentes
  // rotas produce símbolos/privados; un umbral generoso (45%) tolera tablas llenas de números.
  const letras = (sinEspacios.match(/\p{L}/gu) ?? []).length;
  const ratioLetras = letras / sinEspacios.length;
  if (ratioLetras < 0.45) {
    return { usable: false, motivo: `pocas letras (${Math.round(ratioLetras * 100)}%)` };
  }

  // 2. Caracteres corruptos: más de 5% delata extracción rota.
  const corruptos = (sinEspacios.match(RE_CORRUPTOS) ?? []).length;
  if (corruptos / sinEspacios.length > 0.05) {
    return { usable: false, motivo: "caracteres corruptos (fuente sin ToUnicode)" };
  }

  // 3. Separación de palabras: si el promedio de "palabra" es enorme, la extracción vino sin
  // espacios (otra falla típica) y ningún parser ni LLM la leerá bien.
  const palabras = t.split(/\s+/).length;
  const promedio = sinEspacios.length / palabras;
  if (promedio > 25) {
    return {
      usable: false,
      motivo: `sin separación de palabras (promedio ${Math.round(promedio)} chars)`,
    };
  }

  return { usable: true, motivo: "ok" };
}
