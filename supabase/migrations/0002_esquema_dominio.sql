-- Migración 0002 · Esquema de dominio de homologaciones
--
-- Flujo del negocio que modelan estas tablas:
--   1. El estudiante crea un CASO: elige la carrera de la Autónoma del Cauca que quiere
--      homologar (pensum destino), dice de qué universidad viene y sube su certificado en PDF.
--   2. El SISTEMA extrae del PDF las materias de origen (materia_origen) y la IA arma los
--      VÍNCULOS materia_origen -> asignatura destino con un % de similitud, y propone en qué
--      semestre podría ubicarse el estudiante (caso.semestre_sugerido).
--   3. El ADMIN revisa: aprueba o rechaza vínculos y confirma el veredicto.
--
-- Regla central (anti-trampa): el estudiante NO decide qué materias se homologan. Por eso, más
-- abajo, las policies le dan acceso de SOLO LECTURA a materia_origen y vinculo: él envía y ya;
-- escribir ahí es cosa del sistema (con la secret key) y del admin.

-- ============================================================================
-- Catálogo del destino: los planes de la Corporación Universitaria Autónoma del Cauca.
-- ============================================================================

create table pensum (
  id uuid primary key default gen_random_uuid(),
  carrera text not null,
  version text not null, -- ej. "2024-1": el mismo programa puede tener varias versiones de plan
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (carrera, version)
);

create table asignatura (
  id uuid primary key default gen_random_uuid(),
  pensum_id uuid not null references pensum (id) on delete cascade,
  codigo text, -- código institucional de la materia (puede no venir en algunos planes)
  nombre text not null,
  creditos smallint not null check (creditos >= 0),
  semestre smallint not null check (semestre > 0), -- en qué semestre del plan está la materia
  unique (pensum_id, codigo)
);
create index on asignatura (pensum_id);

-- ============================================================================
-- Solicitudes de los estudiantes.
-- ============================================================================

-- procesando  -> recién creado, la IA todavía está extrayendo y emparejando.
-- en_revision -> la IA terminó; espera que el admin lo revise.
-- aprobado / rechazado -> decisión final del admin.
create type estado_caso as enum ('procesando', 'en_revision', 'aprobado', 'rechazado');

create table caso (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references perfil (id) on delete cascade,
  pensum_destino_id uuid not null references pensum (id),
  -- La universidad de origen cambia en cada caso. Guardamos el nombre como texto: sirve igual
  -- si el estudiante la eligió del buscador de instituciones o si la escribió a mano.
  institucion_origen_nombre text not null,
  archivo_pdf text, -- ruta del certificado dentro de Supabase Storage
  estado estado_caso not null default 'procesando',
  -- El veredicto de la IA: en qué semestre podría ubicarse. Lo confirma o ajusta el admin.
  semestre_sugerido smallint check (semestre_sugerido is null or semestre_sugerido > 0),
  creado_en timestamptz not null default now()
);
create index on caso (estudiante_id);

create table materia_origen (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references caso (id) on delete cascade,
  nombre text not null,
  codigo text,
  creditos smallint check (creditos is null or creditos >= 0),
  nota text, -- la nota tal como aparece en el certificado (ej. "4.2", "Aprobado"): texto a propósito
  semestre_origen smallint check (semestre_origen is null or semestre_origen > 0)
);
create index on materia_origen (caso_id);

-- pendiente -> la IA lo propuso, falta que el admin decida.
-- aprobado / rechazado -> decisión del admin.
create type estado_vinculo as enum ('pendiente', 'aprobado', 'rechazado');

create table vinculo (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references caso (id) on delete cascade, -- denormalizado para chequear el dueño en RLS sin más joins
  materia_origen_id uuid not null references materia_origen (id) on delete cascade,
  asignatura_id uuid not null references asignatura (id),
  similitud smallint not null check (similitud between 0 and 100), -- % que estima la IA
  estado estado_vinculo not null default 'pendiente',
  creado_en timestamptz not null default now()
);
create index on vinculo (caso_id);
create index on vinculo (materia_origen_id);

-- ============================================================================
-- Helper de rol para las policies.
-- ============================================================================

-- Devuelve true si el usuario actual es admin. Va con security definer + search_path vacío para
-- que consulte perfil SALTÁNDOSE su RLS: si una policy preguntara el rol con un select normal a
-- perfil, dispararía las policies de perfil y caería en recursión infinita.
create function es_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.perfil
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

-- ============================================================================
-- RLS.
-- ============================================================================

alter table pensum enable row level security;
alter table asignatura enable row level security;
alter table caso enable row level security;
alter table materia_origen enable row level security;
alter table vinculo enable row level security;

-- Catálogo (pensum, asignatura): cualquiera con sesión lo LEE —el estudiante necesita ver las
-- carreras para elegir destino—; solo el admin lo gestiona.
create policy "Pensums visibles con sesión" on pensum
  for select to authenticated using (true);
create policy "Solo admin gestiona pensums" on pensum
  for all to authenticated using (es_admin()) with check (es_admin());

create policy "Asignaturas visibles con sesión" on asignatura
  for select to authenticated using (true);
create policy "Solo admin gestiona asignaturas" on asignatura
  for all to authenticated using (es_admin()) with check (es_admin());

-- Casos: el estudiante ve y crea SOLO los suyos; actualizar y borrar es solo del admin (el
-- estudiante envía y no vuelve a tocarlo). El admin ve y gestiona todos.
create policy "Ver mis casos" on caso
  for select to authenticated
  using (estudiante_id = (select auth.uid()) or es_admin());
create policy "Crear mi caso" on caso
  for insert to authenticated
  with check (estudiante_id = (select auth.uid()) or es_admin());
create policy "Solo admin actualiza casos" on caso
  for update to authenticated using (es_admin()) with check (es_admin());
create policy "Solo admin borra casos" on caso
  for delete to authenticated using (es_admin());

-- materia_origen y vinculo: el estudiante SOLO LEE lo de sus casos. No tiene policy de escritura,
-- así que insertar/editar/borrar queda bloqueado para él (lo hace el sistema con la secret key,
-- y el admin desde el panel). Acá está el candado que impide elegir a dedo qué homologar.
create policy "Ver materias de origen de mis casos" on materia_origen
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = materia_origen.caso_id
        and caso.estudiante_id = (select auth.uid())
    )
  );
create policy "Solo admin gestiona materias de origen" on materia_origen
  for all to authenticated using (es_admin()) with check (es_admin());

create policy "Ver vínculos de mis casos" on vinculo
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from caso
      where caso.id = vinculo.caso_id
        and caso.estudiante_id = (select auth.uid())
    )
  );
create policy "Solo admin gestiona vínculos" on vinculo
  for all to authenticated using (es_admin()) with check (es_admin());
