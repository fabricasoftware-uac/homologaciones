-- Migración 0003 · Bucket de Storage para los certificados (PDF) de los estudiantes
--
-- Cada estudiante sube el certificado de notas de su universidad de origen. Lo guardamos en un
-- bucket PRIVADO (no público) y organizamos los archivos por usuario: la ruta siempre arranca
-- con el id del estudiante ("{uid}/archivo.pdf"). Las policies usan ese primer segmento de la
-- ruta para que cada quien solo pueda tocar su propia carpeta. El admin puede con todo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificados',
  'certificados',
  false, -- privado: son documentos personales, no se sirven por URL pública
  10485760, -- 10 MB de tope por archivo
  array['application/pdf'] -- solo PDFs
)
on conflict (id) do nothing;

-- Storage ya trae RLS activa sobre storage.objects; acá solo agregamos las reglas del bucket.
-- es_admin() y storage.foldername() van calificadas con su esquema porque las policies de
-- storage se evalúan fuera del search_path donde viven nuestras funciones.

create policy "Estudiante sube su certificado" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certificados'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.es_admin()
    )
  );

create policy "Ver mis certificados" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificados'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.es_admin()
    )
  );

create policy "Actualizar mis certificados" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'certificados'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.es_admin()
    )
  );

create policy "Borrar mis certificados" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'certificados'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.es_admin()
    )
  );
