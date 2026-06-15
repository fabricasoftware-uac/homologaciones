-- Datos de arranque para desarrollo local. Supabase corre este archivo automáticamente al
-- final de `pnpm db:reset`.
--
-- Sembramos el pensum REAL de la carrera destino, tomado del folleto oficial de la Corporación
-- Universitaria Autónoma del Cauca: Ingeniería de Software y Computación (SNIES 110398,
-- resolución 15865 de 2019; 9 semestres, 157 créditos). El folleto no trae códigos de materia,
-- así que `codigo` queda en null por ahora.

with plan as (
  insert into pensum (carrera, version)
  values ('Ingeniería de Software y Computación', '2019')
  returning id
)
insert into asignatura (pensum_id, nombre, creditos, semestre)
select plan.id, materia.nombre, materia.creditos, materia.semestre
from plan
cross join (values
  -- Semestre 1
  ('Álgebra Moderna', 4, 1),
  ('Introducción a la Ingeniería', 2, 1),
  ('Introducción a la Programación', 3, 1),
  ('Cátedra Autónoma', 2, 1),
  ('Lectura y Escritura de Textos', 2, 1),
  ('Educación y Legislación Ambiental', 3, 1),
  -- Semestre 2
  ('Cálculo I', 3, 2),
  ('Álgebra Lineal', 2, 2),
  ('Física I', 3, 2),
  ('Programación I', 4, 2),
  ('Cultura Emprendedora', 2, 2),
  ('Ambiente y Sociedad', 3, 2),
  ('Competencias Ciudadanas', 1, 2),
  -- Semestre 3
  ('Cálculo II', 3, 3),
  ('Matemáticas Discretas', 3, 3),
  ('Física II', 3, 3),
  ('Arquitectura de Computadores', 3, 3),
  ('Programación II', 4, 3),
  ('Inglés I', 2, 3),
  -- Semestre 4
  ('Ecuaciones Diferenciales', 3, 4),
  ('Base de Datos I', 4, 4),
  ('Estructura de Datos', 4, 4),
  ('Ingeniería del Software I', 4, 4),
  ('Inglés II', 2, 4),
  ('Transformación Digital e Innovación', 1, 4),
  -- Semestre 5
  ('Probabilidad Computacional y Estadística', 3, 5),
  ('Base de Datos II', 4, 5),
  ('Complejidad Algorítmica', 3, 5),
  ('Desarrollo de Aplicaciones Web', 2, 5),
  ('Ingeniería del Software II', 4, 5),
  ('Inglés III', 2, 5),
  -- Semestre 6
  ('Análisis Numérico', 3, 6),
  ('Arquitectura de Sistemas Operativos', 3, 6),
  ('Base de Datos Avanzadas', 2, 6),
  ('Teoría de la Computación', 3, 6),
  ('Desarrollo de Aplicaciones Móviles', 2, 6),
  ('Calidad del Software I', 3, 6),
  ('Inglés IV', 2, 6),
  -- Semestre 7
  ('Modelado para la Computación', 3, 7),
  ('Redes de Computadores', 2, 7),
  ('Seguridad Informática', 3, 7),
  ('Arquitectura de Software', 3, 7),
  ('Calidad de Software II', 3, 7),
  ('Fundamentos y Metodología de la Investigación', 2, 7),
  ('Herramientas para Pensamiento Filosófico', 2, 7),
  -- Semestre 8
  ('Gestión de Redes', 2, 8),
  ('Sistema de Información Empresarial', 3, 8),
  ('Electiva I (Optativa)', 2, 8),
  ('Electiva III (Especializada)', 3, 8),
  ('Electiva V (Especializada)', 3, 8),
  ('Creatividad e Innovación', 2, 8),
  ('Taller de Investigación', 2, 8),
  -- Semestre 9
  ('HCI', 2, 9),
  ('Práctica Profesional', 2, 9),
  ('Gestión Tecnológica y Financiera', 2, 9),
  ('Electiva II (Optativa)', 2, 9),
  ('Electiva IV (Especializada)', 3, 9),
  ('Electiva VI (Especializada)', 3, 9),
  ('Inteligencia Social y Pensamiento Crítico', 2, 9)
) as materia (nombre, creditos, semestre);
