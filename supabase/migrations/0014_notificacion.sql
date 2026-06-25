-- Migración 0014 · Sistema de notificaciones persistentes (campana del admin)
--
-- Además de los toast efímeros (sileo), guardamos las notificaciones para que el admin tenga un
-- historial con contador de no leídas. Hoy se genera una al llegar una homologación nueva; el diseño
-- admite más tipos. Son globales del panel: cualquier admin las ve y al marcarlas leídas quedan
-- leídas para todos (equipo pequeño). Las inserta "el sistema" (cliente de servicio); el admin solo
-- lee y marca leídas.

create table notificacion (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  cuerpo text,
  caso_id uuid references caso (id) on delete cascade, -- a qué caso lleva al hacer clic (si aplica)
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);
create index on notificacion (creado_en desc);

alter table notificacion enable row level security;

create policy "Admin ve notificaciones" on notificacion
  for select to authenticated
  using (es_admin());

create policy "Admin gestiona notificaciones" on notificacion
  for all to authenticated
  using (es_admin())
  with check (es_admin());

-- Realtime: el admin recibe el INSERT en vivo para encender la campana sin recargar.
alter publication supabase_realtime add table notificacion;
