// Lógica central de la homologación con IA.
//
// Aquí implementaremos la llamada a Groq para que compare ambos pensum: las
// asignaturas que el estudiante ya cursó en su universidad de origen contra las
// asignaturas de la carrera de destino. Le pasaremos las dos listas en el prompt
// y le pediremos que devuelva, por cada materia destino, cuál(es) materia(s) de
// origen la homologan y con qué porcentaje de similitud.
//
// La respuesta de Groq se parsea aquí a nuestro tipo Vinculo (ver src/types) para
// que el profesor/decano luego apruebe o rechace cada sugerencia en la pantalla
// de revisión (/casos/[id]).
