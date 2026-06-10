// Extracción de asignaturas desde un PDF.
//
// Recibe el PDF (el certificado de notas del estudiante, o el pensum oficial de
// una universidad) y extrae su texto para convertirlo en una lista estructurada
// de asignaturas: nombre, código, créditos, intensidad horaria y nota.
//
// Esa lista es la que luego le entregamos a Groq en src/lib/groq/homologar.ts.
// Falta decidir la librería de parseo (pdf-parse, pdfjs, etc.) cuando lleguemos
// a esta fase.
