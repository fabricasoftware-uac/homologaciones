alter table materia_origen add column if not exists intensidad_horaria smallint check (intensidad_horaria is null or intensidad_horaria >= 0);

comment on column materia_origen.intensidad_horaria is 'Intensidad horaria original (SENA). Los créditos son una conversión aproximada: round(IH / 48).';
