-- Migración 0025 · Motor de búsqueda semántica (FASE 6)
--
-- Función que, dado el embedding de una unidad de origen y un pensum destino, devuelve las Top-N
-- asignaturas más SIMILARES por distancia coseno (operador <=> de pgvector). Es el "motor de
-- búsqueda": en el pipeline reduce los candidatos que se le mandan a la IA (de TODO el pensum a solo
-- los más parecidos), que es como se recorta el gasto de tokens.
--
-- Compatible: no toca datos ni tablas existentes, solo agrega una función. Si las asignaturas no
-- tienen embedding (p. ej. sin key de embeddings), devuelve vacío y el pipeline cae al comportamiento
-- anterior (comparar contra todas).
--
-- El embedding se recibe como TEXTO (literal '[...]', que es justo lo que envía supabase-js) y se
-- castea a vector adentro. `similitud` = 1 - distancia_coseno (1 = idénticos, 0 = ortogonales), para
-- que sea intuitivo y consistente con el % de similitud del resto del sistema.

create or replace function buscar_asignaturas_similares(
  p_pensum_id uuid,
  p_embedding text,
  p_top_n int default 10
)
returns table (id uuid, similitud real)
language sql
stable
as $$
  select a.id, (1 - (a.embedding <=> p_embedding::vector))::real as similitud
  from asignatura a
  where a.pensum_id = p_pensum_id
    and a.embedding is not null
  order by a.embedding <=> p_embedding::vector
  limit greatest(p_top_n, 1);
$$;

comment on function buscar_asignaturas_similares is 'Fase 6: Top-N asignaturas del pensum más similares (coseno pgvector) al embedding dado. Reduce los candidatos que se envían a la IA.';
