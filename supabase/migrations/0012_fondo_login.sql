-- Migración 0012 · Fondo del login (degradado elegible)
--
-- La institución elige, desde el panel, el degradado de fondo de la pantalla de ingreso entre varios
-- presets. Guardamos la CLAVE del preset (no el CSS), así los degradados viven en código y se pueden
-- afinar sin tocar la base. 'marca' usa los colores de la institución.
alter table configuracion add column fondo_login text not null default 'marca';
