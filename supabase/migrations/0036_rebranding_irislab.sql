-- Migración 0036: Rebranding oficial a IrisLab
-- Plataforma desarrollada por la Fábrica de Software - Powered by Emprendelab
--
-- Actualiza la fila singleton de configuracion con la identidad de IrisLab y cambia
-- los DEFAULT de las columnas para que cualquier futura re-inserción del seed use
-- los valores correctos.

-- 1. Actualizar la fila viva (id = 1 es el único registro permitido por CHECK).
UPDATE configuracion
SET nombre_institucion = 'IrisLab',
    eslogan            = 'Sistema Inteligente de Homologaciones Académicas'
WHERE id = 1;

-- 2. Ajustar los DEFAULT para que el seed y cualquier recreación de la fila
--    salgan con los valores IrisLab sin necesidad de un UPDATE posterior.
ALTER TABLE configuracion
  ALTER COLUMN nombre_institucion SET DEFAULT 'IrisLab',
  ALTER COLUMN eslogan            SET DEFAULT 'Sistema Inteligente de Homologaciones Académicas';

-- 3. Documentar la tabla con la identidad del producto.
COMMENT ON TABLE configuracion IS
  'Configuración visual y de marca institucional para IrisLab '
  '(Fábrica de Software / Emprendelab).';
