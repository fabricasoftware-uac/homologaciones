-- Migración 0033 · Embedding sin dimensión fija
--
-- El modelo qwen/qwen3-embedding-8b produce vectores de 4096 dimensiones.
-- Cambiamos las columnas de vector(768) a vector (sin fijar dimensión)
-- para que acepten cualquier modelo de embedding futuro sin migrar de nuevo.

alter table materia_origen alter column embedding type vector;
alter table asignatura alter column embedding type vector;

comment on column materia_origen.embedding is 'Embedding (OpenRouter qwen/qwen3-embedding-8b, 4096d).';
comment on column asignatura.embedding is 'Embedding (OpenRouter qwen/qwen3-embedding-8b, 4096d).';
