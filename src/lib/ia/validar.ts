import { llamarOpenRouter, MODELOS_LIGEROS as MODELOS_LIGEROS_OR } from "@/lib/openrouter/cliente";

// Validación de contenido del PDF con IA: ¿el archivo que subió la persona es de verdad un
// documento académico (certificado de notas / historial / pensum) y no publicidad, contenido para
// adultos o spam?
//
// Política ante fallo (IA sin respuesta): FAIL-OPEN -> lo dejamos pasar. El admin revisa cada
// caso a mano antes de aprobarlo, así que un archivo dudoso queda atrapado en esa revisión; preferimos
// eso a bloquear envíos legítimos cuando la IA está caída. (La detección de imágenes —p. ej. NSFW
// escaneado— necesitaría un modelo de visión; eso es un trabajo aparte.)

export type VeredictoDocumento = { valido: boolean; motivo: string };

const SISTEMA = `Eres un filtro de contenido para una plataforma de homologaciones universitarias en Colombia.
Recibes el TEXTO extraído de un PDF que una persona subió como soporte académico (certificado de notas, historial académico, constancia, pensum...).

REGLA DE ORO: en la duda, ACEPTA ("valido": true). Un asesor humano revisa cada caso después; tu único trabajo es frenar contenido claramente inapropiado, NO juzgar la autenticidad.

ACEPTA todo documento con estructura académica plausible: historiales o certificados de cualquier institución, en cualquier formato, con o sin sellos, incluso si dice ser un ejemplo, borrador o documento de prueba (eso lo evalúa el asesor, no tú).

RECHAZA ("valido": false) SOLO con evidencia clara de que NO es un documento académico:
- contenido sexual o para adultos
- publicidad o material promocional
- spam o texto sin sentido
- documentos de otro dominio sin relación académica (facturas, contratos, recetas, currículums...)

Responde ÚNICAMENTE un objeto JSON con esta forma exacta:
{"valido": true|false, "motivo": "explicación breve en español neutro"}`;

// Señales inequívocas de documento académico. Un certificado de notas real trae varias de estas
// palabras sí o sí; la publicidad o el spam, ninguna.
//
// OJO con las fronteras: los términos van por RAÍZ y terminan en \w* a propósito. Una versión previa
// usaba \b al final ("\baprobad\b", "\bcompetencia\b") y no matcheaba NADA —"aprobado" tiene una "o"
// después de la raíz, "COMPETENCIAS" una "s"—, así que el atajo nunca disparaba y cada documento
// gastaba una llamada a la IA de la cuota diaria.
const SENALES_ACADEMICAS =
  /\b(asignatura\w*|materia\w*|semestre\w*|cr[eé]dito\w*|calificaci[oó]n\w*|promedio\w*|pensum\w*|plan de estudios|competencia\w*|resultados? de aprendizaje|historial acad[eé]mico|certificad\w*|constancia\w*|matriculad\w*|aprobad\w*|instituci[oó]n educativa|universidad\w*|sena|programa de formaci[oó]n)\b/gi;

const MIN_SENALES = 3;

export async function validarDocumentoAcademico(texto: string): Promise<VeredictoDocumento> {
  const recorte = texto.slice(0, 3000); // basta para clasificar (académico vs spam); menos tokens

  // ATAJO SIN IA (clave con el plan gratuito: la cuota diaria de OpenRouter es de ~50 requests para
  // TODA la cuenta). Si el texto ya trae varias señales académicas inequívocas, no hace falta
  // preguntarle a nadie: el documento pasa y esa llamada queda disponible para el emparejamiento,
  // que es donde la IA sí aporta. Solo los documentos SIN señal clara llegan al modelo.
  const senales = new Set((recorte.match(SENALES_ACADEMICAS) ?? []).map((s) => s.toLowerCase()));
  if (senales.size >= MIN_SENALES) {
    return { valido: true, motivo: "documento académico reconocido sin IA" };
  }

  const mensajes = [
    { role: "system" as const, content: SISTEMA },
    { role: "user" as const, content: recorte },
  ];

  const contenido =
    (await llamarOpenRouter(mensajes, { json: true, modelos: MODELOS_LIGEROS_OR, maxTokens: 500 }));

  if (!contenido) {
    return { valido: true, motivo: "validación no disponible" };
  }

  try {
    const parsed = JSON.parse(contenido) as Partial<VeredictoDocumento>;
    return { valido: Boolean(parsed.valido), motivo: String(parsed.motivo ?? "") };
  } catch {
    console.error("[ia] La respuesta no era JSON válido:", contenido);
    return { valido: true, motivo: "validación no disponible" };
  }
}
