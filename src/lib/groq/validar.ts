import { llamarGroq, MODELOS_LIGEROS } from "./cliente";

// Validación de contenido del PDF con IA: ¿el archivo que subió la persona es de verdad un
// documento académico (certificado de notas / historial / pensum) y no publicidad, contenido para
// adultos o spam?
//
// Política ante fallo (Groq sin respuesta): FAIL-OPEN -> lo dejamos pasar. El admin revisa cada
// caso a mano antes de aprobarlo, así que un archivo dudoso queda atrapado en esa revisión; preferimos
// eso a bloquear envíos legítimos cuando la IA está caída. (La detección de imágenes —p. ej. NSFW
// escaneado— necesitaría un modelo de visión; eso es un trabajo aparte.)

export type VeredictoDocumento = { valido: boolean; motivo: string };

const SISTEMA = `Eres un validador de documentos para una plataforma de homologaciones universitarias en Colombia.
Recibes el TEXTO extraído de un PDF que una persona subió como su certificado de notas, historial académico o pensum.
Decide si el documento es un certificado de calificaciones, historial académico o pensum universitario LEGÍTIMO.
RECHAZA: publicidad o material promocional, contenido sexual o para adultos, documentos no académicos, texto sin sentido o spam.
Responde ÚNICAMENTE un objeto JSON con esta forma exacta:
{"valido": true|false, "motivo": "explicación breve en español neutro"}`;

export async function validarDocumentoAcademico(texto: string): Promise<VeredictoDocumento> {
  const recorte = texto.slice(0, 3000); // basta para clasificar (académico vs spam); menos tokens
  // Va en la cadena LIGERA (20b primero) para NO gastar el cupo del 120b, que reservamos para la
  // extracción de materias. Así validar + extraer no compiten por el mismo límite de tokens/min.
  const contenido = await llamarGroq(
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: recorte },
    ],
    { json: true, modelos: MODELOS_LIGEROS },
  );

  if (!contenido) {
    return { valido: true, motivo: "validación no disponible" };
  }

  try {
    const parsed = JSON.parse(contenido) as Partial<VeredictoDocumento>;
    return { valido: Boolean(parsed.valido), motivo: String(parsed.motivo ?? "") };
  } catch {
    console.error("[groq] La respuesta no era JSON válido:", contenido);
    return { valido: true, motivo: "validación no disponible" };
  }
}
