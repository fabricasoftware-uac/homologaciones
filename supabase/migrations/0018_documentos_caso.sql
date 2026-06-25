-- Migración 0018 · Documentos adicionales del caso (contenidos programáticos / syllabi)
--
-- Hasta ahora el caso guardaba un solo PDF: el certificado de notas (caso.archivo_pdf). Pero una
-- homologación real casi siempre exige también los CONTENIDOS PROGRAMÁTICOS (syllabi) de las
-- materias cursadas. Esta tabla permite adjuntar varios documentos por caso.
--
-- Los archivos viven en el mismo bucket privado `certificados`, bajo la carpeta del estudiante
-- ({uid}/...), así que reutilizan sus policies de storage. Aquí solo guardamos la metadata + la ruta.
--
-- RLS (espejo de materia_origen): el estudiante SOLO LEE los documentos de sus casos; el alta la
-- hace el sistema con la secret key al recibir la solicitud (y el admin desde el panel).

create table documento_caso (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references caso(id) on delete cascade,
  tipo text not null default 'syllabus',
  ruta text not null,
  nombre_archivo text not null,
  creado_en timestamptz not null default now()
);

create index on documento_caso (caso_id);

alter table documento_caso enable row level security;

create policy "Ver documentos de mis casos" on documento_caso
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = documento_caso.caso_id
        and caso.estudiante_id = (select auth.uid())
    )
  );

create policy "Solo admin gestiona documentos" on documento_caso
  for all to authenticated using (es_admin()) with check (es_admin());
