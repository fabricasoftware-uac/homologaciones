-- Migración 0008 · Nota del admin para el estudiante + realtime en los casos
--
-- nota_admin: un mensaje opcional que el admin le deja al estudiante al revisar (aclaraciones,
-- requisitos, etc.). El estudiante lo ve en el detalle de su homologación.
alter table caso add column nota_admin text;

-- Realtime: agregamos `caso` a la publicación para que la bandeja del admin se actualice sola
-- (sin recargar la página) y para avisarle cuando entra una homologación nueva. La RLS sigue
-- aplicando: cada quien solo recibe cambios de las filas que puede ver (el admin, todas).
alter publication supabase_realtime add table caso;
