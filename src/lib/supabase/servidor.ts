// Cliente de Supabase para el SERVIDOR (route handlers y server components).
//
// Este es el cliente que usaremos cuando necesitemos privilegios elevados:
// guardar el resultado de una homologación, escribir un pensum nuevo extraído
// del PDF, o cualquier operación que no debe depender del navegador.
// Aquí sí podemos usar la SUPABASE_SERVICE_ROLE_KEY porque nunca se expone al cliente.
