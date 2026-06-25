-- Migración 0020 · Paleta del modo oscuro (personalizable)
--
-- La institución elige una de las paletas predefinidas para el modo oscuro (ver lib/marca/temas-
-- oscuros.ts). Se guarda solo la clave; el layout raíz inyecta los colores correspondientes sobre la
-- clase .dark en runtime. Por defecto 'pizarra' (la paleta slate base).
alter table configuracion add column tema_oscuro text not null default 'pizarra';
