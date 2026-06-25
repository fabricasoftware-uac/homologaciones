-- Migración 0007 · PDF del plan de estudios por carrera (lo gestiona el admin)
--
-- Cada carrera (pensum) puede tener el PDF de su plan de estudios. Lo guardamos en un bucket
-- 'planes' PÚBLICO —la oferta académica no es información sensible y así se ve con su URL directa—,
-- pero solo el admin puede subir, reemplazar o borrar. La ruta de cada PDF se guarda en
-- pensum.archivo_pdf.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planes', 'planes', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Lectura pública; escritura solo admin. es_admin() va calificada con su esquema porque las policies
-- de storage se evalúan fuera del search_path donde vive la función.
create policy "Planes visibles para todos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'planes');

create policy "Admin sube planes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'planes' and public.es_admin());

create policy "Admin actualiza planes" on storage.objects
  for update to authenticated
  using (bucket_id = 'planes' and public.es_admin())
  with check (bucket_id = 'planes' and public.es_admin());

create policy "Admin borra planes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'planes' and public.es_admin());

-- Ruta del PDF del plan dentro del bucket 'planes' (null si la carrera aún no tiene plan cargado).
alter table pensum add column archivo_pdf text;
