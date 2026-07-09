-- ── Esquema y RLS para los roles asesor y verificador ──

-- 1) Asignación de casos: el admin asigna cada caso a un asesor (manual, por caso).
alter table caso add column asesor_id uuid references perfil (id) on delete set null;
create index caso_asesor_idx on caso (asesor_id);

-- 2) Gestión de inscripción (verificador): estado del contacto con el estudiante, nota propia del
--    verificador y marca de matrícula por materia aprobada.
alter table caso add column inscripcion_estado text not null default 'pendiente'
  check (inscripcion_estado in ('pendiente', 'contactado', 'inscrito'));
alter table caso add column nota_verificador text;
alter table vinculo add column matriculado boolean not null default false;

-- 3) Notificaciones dirigidas: con destinatario, solo la ve esa persona (además del admin, que ve
--    todas); sin destinatario, es la campana general del equipo admin.
alter table notificacion add column destinatario_id uuid references perfil (id) on delete cascade;

-- 4) Helpers de rol (mismo patrón que es_admin: security definer para no recursar la RLS de perfil).
create function es_asesor()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.perfil
    where id = (select auth.uid()) and rol = 'asesor'
  );
$$;

create function es_verificador()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.perfil
    where id = (select auth.uid()) and rol = 'verificador'
  );
$$;

-- 5) RLS: se agregan dos brazos a las policies existentes —el asesor sobre SUS casos asignados y el
--    verificador en solo-lectura sobre los aprobados—. Las escrituras del verificador (estado de
--    inscripción, nota, matriculado) NO van por RLS: pasan por server actions con re-chequeo de rol
--    y cliente de servicio, para no necesitar policies por columna.

-- caso
drop policy "Ver mis casos" on caso;
create policy "Ver mis casos" on caso
  for select to authenticated
  using (
    estudiante_id = (select auth.uid())
    or es_admin()
    or (es_asesor() and asesor_id = (select auth.uid()))
    or (es_verificador() and estado = 'aprobado')
  );

drop policy "Solo admin actualiza casos" on caso;
create policy "Admin o asesor asignado actualiza casos" on caso
  for update to authenticated
  using (es_admin() or (es_asesor() and asesor_id = (select auth.uid())))
  with check (es_admin() or (es_asesor() and asesor_id = (select auth.uid())));

-- vinculo
drop policy "Ver vínculos de mis casos" on vinculo;
create policy "Ver vínculos de mis casos" on vinculo
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = vinculo.caso_id
        and (
          caso.estudiante_id = (select auth.uid())
          or (es_asesor() and caso.asesor_id = (select auth.uid()))
          or (es_verificador() and caso.estado = 'aprobado')
        )
    )
  );

drop policy "Solo admin gestiona vínculos" on vinculo;
create policy "Admin o asesor asignado gestiona vínculos" on vinculo
  for all to authenticated
  using (
    es_admin()
    or (es_asesor() and exists (
      select 1 from caso
      where caso.id = vinculo.caso_id and caso.asesor_id = (select auth.uid())
    ))
  )
  with check (
    es_admin()
    or (es_asesor() and exists (
      select 1 from caso
      where caso.id = vinculo.caso_id and caso.asesor_id = (select auth.uid())
    ))
  );

-- materia_origen
drop policy "Ver materias de origen de mis casos" on materia_origen;
create policy "Ver materias de origen de mis casos" on materia_origen
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = materia_origen.caso_id
        and (
          caso.estudiante_id = (select auth.uid())
          or (es_asesor() and caso.asesor_id = (select auth.uid()))
          or (es_verificador() and caso.estado = 'aprobado')
        )
    )
  );

drop policy "Solo admin gestiona materias de origen" on materia_origen;
create policy "Admin o asesor asignado gestiona materias de origen" on materia_origen
  for all to authenticated
  using (
    es_admin()
    or (es_asesor() and exists (
      select 1 from caso
      where caso.id = materia_origen.caso_id and caso.asesor_id = (select auth.uid())
    ))
  )
  with check (
    es_admin()
    or (es_asesor() and exists (
      select 1 from caso
      where caso.id = materia_origen.caso_id and caso.asesor_id = (select auth.uid())
    ))
  );

-- documento_caso (syllabi adjuntos): el asesor asignado también los ve.
drop policy "Ver documentos de mis casos" on documento_caso;
create policy "Ver documentos de mis casos" on documento_caso
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = documento_caso.caso_id
        and (
          caso.estudiante_id = (select auth.uid())
          or (es_asesor() and caso.asesor_id = (select auth.uid()))
        )
    )
  );

-- plantilla_nota: el asesor finaliza casos y usa las plantillas (solo lectura; la gestión sigue
-- siendo del admin vía la policy ALL existente).
create policy "Asesor ve plantillas" on plantilla_nota
  for select to authenticated
  using (es_asesor());

-- notificacion: cada quien ve las dirigidas a él; el admin ve todas (incluidas las generales, que
-- van sin destinatario).
drop policy "Admin ve notificaciones" on notificacion;
create policy "Ver notificaciones" on notificacion
  for select to authenticated
  using (es_admin() or destinatario_id = (select auth.uid()));

drop policy "Admin gestiona notificaciones" on notificacion;
create policy "Gestionar notificaciones" on notificacion
  for all to authenticated
  using (es_admin() or destinatario_id = (select auth.uid()))
  with check (es_admin() or destinatario_id = (select auth.uid()));
