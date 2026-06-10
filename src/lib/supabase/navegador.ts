// Cliente de Supabase para el lado del NAVEGADOR (componentes "use client").
//
// Aquí crearemos la instancia de Supabase que usan las páginas para leer datos
// en tiempo real: listar los casos de homologación, traer los pensum guardados, etc.
// Usa la "anon key" pública (NEXT_PUBLIC_SUPABASE_ANON_KEY), nunca la service role,
// porque este código viaja al navegador del usuario.
