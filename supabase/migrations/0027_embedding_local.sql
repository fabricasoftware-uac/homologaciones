-- Migración 0027 · Embedding local (384 dims)
--
-- Reemplazamos Gemini por un modelo de embedding local (Xenova/paraphrase-multilingual-MiniLM-L12-v2)
-- que genera vectores de 384 dimensiones. Corresponde con el cambio en src/lib/embedding.ts.

alter table materia_origen alter column embedding type vector;
alter table asignatura alter column embedding type vector;

comment on column materia_origen.embedding is 'Embedding (modelo local multilingual, 384 dims). Fase 5.';
comment on column asignatura.embedding is 'Embedding (modelo local multilingual, 384 dims). Fase 5.';
