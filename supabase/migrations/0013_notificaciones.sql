-- Migración 0013 · Personalización de las notificaciones (sileo)
--
-- La institución elige, desde el panel, el color y la posición de las notificaciones toast. El color
-- por defecto es un azul neutro; la posición, arriba al centro (más visible y menos intrusiva).
alter table configuracion add column notif_color text not null default '#2563eb';
alter table configuracion add column notif_posicion text not null default 'top-center';
