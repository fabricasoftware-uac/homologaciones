// Endpoint del análisis de homologación (lado servidor).
//
// Aquí va a llegar la petición cuando el usuario inicia un estudio desde
// /casos/nuevo: recibirá el PDF (o la referencia al archivo ya subido) y la
// carrera de destino. El flujo será:
//
//   1. Extraer las asignaturas del PDF        -> src/lib/pdf/extraer.ts
//   2. Traer el pensum de la carrera destino  -> Supabase (src/lib/supabase/servidor.ts)
//   3. Comparar ambos pensum con Groq         -> src/lib/groq/homologar.ts
//   4. Devolver los vínculos sugeridos con su % de similitud para que el
//      profesor los revise en /casos/[id].
//
// Se hace en el servidor para que la GROQ_API_KEY y la service role de Supabase
// nunca lleguen al navegador.
//
// Pendiente: exportar los handlers HTTP (ej. POST) cuando implementemos la lógica.

// Por ahora lo dejamos como módulo vacío para que Next lo reconozca como ruta.
// Mientras no haya handlers, este endpoint responde 405 (método no permitido).
export {};
