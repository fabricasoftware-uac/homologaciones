-- Migración 0023 · Persistencia de la información normalizada (FASE 4)
--
-- Las fases 1-3 producen, por cada unidad académica (materia universitaria / competencia SENA), una
-- versión NORMALIZADA con campos enriquecidos: una `descripcion` para el matching, la lista de
-- `componentes` (resultados de aprendizaje, temas/unidades…) y un `texto_embedding` (texto consolidado
-- para la búsqueda semántica). Hasta ahora esos campos se calculaban en memoria y se DESCARTABAN al
-- guardar (procesarCaso solo persistía nombre/creditos/nota/semestre/tipo/metadatos).
--
-- Esta migración los PERSISTE. Es 100% compatible: son columnas NUEVAS y NULLABLE, así que el código
-- existente y las filas viejas siguen funcionando igual (acta, UI del admin, mis-homologaciones no
-- necesitan cambios). No se generan embeddings todavía (eso es la Fase 5): aquí solo guardamos el
-- TEXTO base (texto_embedding) del que la Fase 5 generará el vector con pgvector.

-- ── Unidad académica (materia_origen): campos normalizados ──
alter table materia_origen add column descripcion text;      -- descripción enriquecida (nombre + componentes) para el matching IA
alter table materia_origen add column componentes jsonb;     -- sub-items estructurados: RAs del SENA, temas/unidades de una materia
alter table materia_origen add column texto_embedding text;  -- texto consolidado; base del embedding de la Fase 5

comment on column materia_origen.descripcion is 'Descripción enriquecida de la unidad (nombre + componentes) usada para el matching IA.';
comment on column materia_origen.componentes is 'Sub-items estructurados: resultados de aprendizaje (SENA), temas/unidades (materias).';
comment on column materia_origen.texto_embedding is 'Texto consolidado (nombre + descripción + componentes). Base del embedding de la Fase 5; el vector se agrega después con pgvector.';

-- ── Documento (caso): con qué se procesó el certificado ──
alter table caso add column metodo_extraccion text;  -- extractor usado: 'ParserIA' | 'SenaParser'
alter table caso add column tipo_institucion text;   -- tipo detectado: 'sena' | 'universitaria' | 'desconocida'

comment on column caso.metodo_extraccion is 'Extractor que procesó el documento del caso (ParserIA, SenaParser).';
comment on column caso.tipo_institucion is 'Tipo de institución de origen detectado: sena, universitaria, desconocida.';
