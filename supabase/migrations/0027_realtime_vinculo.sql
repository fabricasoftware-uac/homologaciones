-- ── Realtime para vínculos ──
--
-- La vista del estudiante (mis-homologaciones/[id]) solo escuchaba UPDATE de `caso`, así que las
-- acciones del admin que mutan vínculos sin tocar el caso (vincular, desvincular, confirmar
-- sugerencias) no refrescaban su pantalla: el estudiante seguía viendo una propuesta que ya no
-- existía en la BD (desfase estudiante-ve / admin-no-ve). Publicar `vinculo` permite suscribirse a
-- sus INSERT/UPDATE del caso propio (la RLS de lectura de vinculo aplica también a realtime).
alter publication supabase_realtime add table public.vinculo;
