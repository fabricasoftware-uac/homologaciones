-- Migración 0022 · Unidad académica: modelo genérico de extracción
--
-- El concepto "materia origen" es demasiado específico: solo describe materias
-- universitarias tradicionales. Lo reemplazamos por "unidad académica", una entidad
-- genérica que puede representar cualquier estructura educativa:
--
--   - Materias universitarias (tipo = 'materia')
--   - Competencias del SENA (tipo = 'competencia')
--   - Futuras estructuras: módulos, créditos académicos, resultados de aprendizaje, etc.
--
-- Dos columnas nuevas:
--   1. tipo: clasifica la unidad académica. Default 'materia' para que las filas
--      existentes y el código viejo sigan funcionando sin cambios.
--   2. metadatos: jsonb para datos específicos de cada tipo de institución. El SENA
--      guarda aquí la lista de resultados de aprendizaje; otras instituciones podrán
--      guardar lo que necesiten sin cambiar el esquema.

alter table materia_origen add column tipo text not null default 'materia';
alter table materia_origen add column metadatos jsonb;

comment on column materia_origen.tipo is 'Clasificación de la unidad académica: materia, competencia, etc.';
comment on column materia_origen.metadatos is 'Datos estructurados específicos del tipo (ej. RAs del SENA).';
