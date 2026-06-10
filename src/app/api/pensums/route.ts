// Endpoint de planes académicos / pensum (lado servidor).
//
// Aquí manejaremos guardar y consultar los pensum en Supabase. Cuando un admin
// sube el PDF oficial de una universidad en /carreras, extraemos sus asignaturas
// (src/lib/pdf/extraer.ts) y las persistimos como un plan académico para poder
// usarlas después como "destino" en las homologaciones.
//
// Métodos previstos:
//   - GET  -> listar los pensum disponibles (por carrera).
//   - POST -> guardar un pensum nuevo extraído del PDF.
//
// Pendiente: exportar los handlers HTTP cuando implementemos la lógica.

// Por ahora lo dejamos como módulo vacío para que Next lo reconozca como ruta.
// Mientras no haya handlers, este endpoint responde 405 (método no permitido).
export {};
