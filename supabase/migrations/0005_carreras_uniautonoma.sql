-- Migración 0005 · Programas (carreras) que ofrece la Autónoma del Cauca
--
-- El estudiante elige a qué carrera destino quiere homologar. Hasta ahora solo existía el pensum de
-- Ingeniería de Software y Computación (lo siembra seed.sql con sus asignaturas). Aquí agregamos los
-- DEMÁS programas que ofrece la universidad para que aparezcan en el desplegable. Por ahora son solo
-- la carrera (sin asignaturas cargadas todavía); su pensum real se cargará más adelante.
--
-- No incluimos Ingeniería de Software y Computación: ya la crea seed.sql, y duplicarla chocaría con
-- el unique (carrera, version) en un db:reset. `on conflict do nothing` lo hace idempotente.
insert into pensum (carrera, version) values
  ('Administración de Empresas', '2024'),
  ('Contaduría Pública', '2024'),
  ('Derecho', '2024'),
  ('Entrenamiento Deportivo', '2024'),
  ('Finanzas y Negocios Internacionales', '2024'),
  ('Gobierno y Relaciones Internacionales', '2024'),
  ('Ingeniería Ambiental y de Saneamiento', '2024'),
  ('Ingeniería Civil', '2024'),
  ('Ingeniería Electrónica', '2024'),
  ('Ingeniería Energética', '2024'),
  ('Licenciatura en Educación Infantil', '2024'),
  ('Matemáticas Aplicadas en Ciencia de Datos', '2024')
on conflict (carrera, version) do nothing;
