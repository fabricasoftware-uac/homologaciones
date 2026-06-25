-- Migración 0019 · Plantillas de nota para el estudiante
--
-- Respuestas reutilizables que el asesor inserta en la "nota para el estudiante" al cerrar un caso
-- (p. ej. "Debes presentar los programas de las materias en admisiones"). Ahorran escribir lo mismo
-- una y otra vez. Las gestiona el admin; aquí dejamos algunas por defecto.

create table plantilla_nota (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  creado_en timestamptz not null default now()
);

alter table plantilla_nota enable row level security;

-- Solo el admin las ve y las gestiona (no son para el estudiante).
create policy "Solo admin gestiona plantillas" on plantilla_nota
  for all to authenticated using (es_admin()) with check (es_admin());

insert into plantilla_nota (texto) values
  ('Para formalizar tu homologación, presenta los programas (contenidos) de las materias homologadas en la oficina de admisiones.'),
  ('Tu homologación quedó aprobada. Acércate a admisiones con tu documento de identidad para continuar con la matrícula.'),
  ('Algunas materias no se homologaron porque no encontramos una equivalencia suficiente en el plan de estudios. Puedes consultarlo con tu asesor.');
