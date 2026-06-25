-- Migración 0021 · Logo para modo oscuro
--
-- Un solo logo no se ve bien en ambos modos: el logo "claro" (oscuro/de color) se pierde sobre el
-- fondo oscuro, y un logo "claro/blanco" se pierde sobre el fondo blanco. Por eso la institución
-- puede subir una segunda versión para el modo oscuro. Nullable: si no la sube, se usa el logo normal
-- en ambos modos (con su placa de fondo, como hasta ahora).
alter table configuracion add column logo_oscuro_path text;
