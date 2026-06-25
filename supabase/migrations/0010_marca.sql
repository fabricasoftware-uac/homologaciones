-- Migración 0010 · Marca / personalización (white-label)
--
-- El sistema se vende a cualquier entidad educativa, así que la identidad visual no puede estar
-- quemada en el código. Una sola fila de configuración guarda el nombre, el logo y los colores de la
-- institución. La leen TODAS las pantallas (incluido el login y el formulario del invitado, por eso
-- es legible por anónimos); solo el admin la edita desde el panel de Configuración.

create table configuracion (
  id smallint primary key default 1 check (id = 1), -- singleton: siempre una única fila
  nombre_institucion text not null default 'TransfoEdu',
  logo_path text, -- ruta del logo dentro del bucket 'marca' (null = sin logo, se usa el monograma)
  color_primario text not null default '#1e40af',
  color_acento text not null default '#0ea5e9',
  actualizado_en timestamptz not null default now()
);

-- Sembramos la fila única con los valores por defecto.
insert into configuracion (id) values (1) on conflict (id) do nothing;

alter table configuracion enable row level security;

-- La marca se muestra en pantallas públicas (login, formulario del invitado): lectura para todos.
create policy "Marca visible para todos" on configuracion
  for select to anon, authenticated using (true);
-- Solo el admin la cambia (la fila ya existe, así que basta con update).
create policy "Solo admin edita la marca" on configuracion
  for update to authenticated using (es_admin()) with check (es_admin());

-- Bucket público para el logo; solo el admin sube, reemplaza o borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy "Logos visibles para todos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'marca');

create policy "Admin sube logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marca' and public.es_admin());

create policy "Admin actualiza logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'marca' and public.es_admin())
  with check (bucket_id = 'marca' and public.es_admin());

create policy "Admin borra logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marca' and public.es_admin());
