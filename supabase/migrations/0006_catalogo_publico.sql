-- Migración 0006 · El catálogo de carreras es PÚBLICO (lo ve el invitado sin sesión)
--
-- El estudiante entra como invitado y su sesión anónima recién se crea al ENVIAR la solicitud. Pero
-- para elegir la carrera destino tiene que ver el catálogo ANTES de eso, cuando todavía es rol
-- `anon` (sin sesión). Las policies originales (migración 0002) solo dejaban leer a `authenticated`,
-- así que al invitado se le mostraba el desplegable vacío.
--
-- La oferta académica (pensum y sus asignaturas) es información pública, no hay nada sensible, así
-- que abrimos la lectura también a `anon`. La gestión (crear/editar) sigue siendo solo del admin.

drop policy "Pensums visibles con sesión" on pensum;
create policy "Pensums visibles para todos" on pensum
  for select to anon, authenticated using (true);

drop policy "Asignaturas visibles con sesión" on asignatura;
create policy "Asignaturas visibles para todos" on asignatura
  for select to anon, authenticated using (true);
