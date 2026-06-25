-- Migración 0015 · Color del botón/acción de eliminar (personalizable)
--
-- La institución elige el color del botón de confirmación de borrado (el modal de "¿Eliminar?").
-- Los despliegues nuevos parten del rojo convencional para acciones destructivas; la fila existente
-- hereda el color primario (Michael ya lo había puesto azul), y todos pueden cambiarlo en el panel.
alter table configuracion add column color_eliminar text not null default '#dc2626';
update configuracion set color_eliminar = color_primario where id = 1;
