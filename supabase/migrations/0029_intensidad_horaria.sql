-- Migración 0029 · Intensidad horaria SENA
--
-- Las competencias del SENA tienen intensidad horaria (IH), no créditos. Guardamos AMBOS:
--   - creditos: conversión aproximada (round(IH / 48)), para que el matching y la estimación
--     del semestre tengan una referencia comparable con los créditos universitarios.
--   - intensidad_horaria: valor original (horas), para trazabilidad.
--
-- La fórmula es el estándar colombiano: 1 crédito ≈ 48 horas.

alter table materia_origen add column intensidad_horaria smallint check (intensidad_horaria is null or intensidad_horaria >= 0);

comment on column materia_origen.intensidad_horaria is 'Intensidad horaria original (SENA). Los créditos son una conversión aproximada: round(IH / 48).';
