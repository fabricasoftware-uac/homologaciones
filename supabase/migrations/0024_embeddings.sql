-- Migración 0024 · Embeddings con pgvector (FASE 5)
--
-- Prepara la BÚSQUEDA SEMÁNTICA (que se usará en la Fase 6). Cada unidad académica de origen
-- (materia_origen) y cada asignatura destino guarda un embedding de 768 dimensiones, generado con
-- Gemini `gemini-embedding-001` (768 dims) a partir de su texto (texto_embedding / nombre).
--
-- IMPORTANTE (regla del plan): en esta fase SOLO se generan y almacenan los vectores. NO se hacen
-- búsquedas vectoriales todavía (ni índice ivfflat/hnsw): eso es la Fase 6. Es 100% compatible: las
-- columnas son NUEVAS y NULLABLE, así que las filas y el código existentes siguen funcionando igual
-- (las que no tengan embedding simplemente quedan en null).

create extension if not exists vector;

alter table materia_origen add column embedding vector(768);
alter table asignatura add column embedding vector(768);

comment on column materia_origen.embedding is 'Embedding de 768 dims (Gemini text-embedding-004) de texto_embedding. Fase 5; la búsqueda vectorial es Fase 6.';
comment on column asignatura.embedding is 'Embedding de 768 dims (Gemini text-embedding-004) del nombre de la asignatura. Fase 5.';
