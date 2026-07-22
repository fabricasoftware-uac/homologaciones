-- Migración 0034 · Cambio de modelo de embeddings a openai/text-embedding-3-small (1024 dims)
--
-- POR QUÉ SE VACÍAN LOS VECTORES
-- Los embeddings de dos modelos distintos viven en espacios semánticos distintos: el coseno entre
-- uno y otro no significa nada, y si además difieren en dimensión, pgvector directamente LANZA al
-- aplicar el operador <=>. Como el backfill de asignaturas solo rellena las que están en null
-- (ver asegurarEmbeddingsAsignaturas en src/lib/homologacion/procesar.ts), un vector viejo nunca se
-- refrescaría solo: se quedaría ahí rompiendo la búsqueda vectorial de forma permanente y
-- silenciosa (el motor caería siempre al camino legacy, gastando tokens de más sin avisar).
--
-- Vaciarlos es barato: se regeneran perezosamente la próxima vez que se procese un caso de esa
-- carrera. No se pierde nada que no se pueda recalcular.
--
-- La columna se queda como `vector` SIN dimensión fija (migración 0033), así que no hace falta
-- tocar el tipo. Si en el futuro se quisiera un índice HNSW/ivfflat habría que fijarla a
-- vector(1024) primero — ahora no hace falta: son ~59 asignaturas por pensum y el escaneo
-- secuencial es instantáneo.

update asignatura set embedding = null where embedding is not null;
update materia_origen set embedding = null where embedding is not null;

comment on column materia_origen.embedding is 'Embedding de 1024 dims (OpenRouter openai/text-embedding-3-small, parámetro dimensions) de texto_embedding.';
comment on column asignatura.embedding is 'Embedding de 1024 dims (OpenRouter openai/text-embedding-3-small, parámetro dimensions) del nombre de la asignatura.';
