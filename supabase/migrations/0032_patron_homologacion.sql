-- Migración 0032 · Aprendizaje por PATRONES (generaliza el caché de decisiones)
--
-- POR QUÉ HACE FALTA, si ya existe decision_matching (0026):
--
-- decision_matching acierta solo con IGUALDAD EXACTA: su clave es el sha256 del texto_embedding de
-- la unidad de origen (nombre + descripción + TODOS los resultados de aprendizaje). Basta con que
-- una constancia del SENA traiga un RA redactado distinto, una tilde de más o un RA extra para que
-- el hash cambie y la decisión que el asesor ya tomó NO se reutilice. En la práctica el caché solo
-- sirve para el MISMO documento, no para el mismo conocimiento.
--
-- patron_homologacion aprende un nivel más arriba: la clave es el NOMBRE NORMALIZADO de la unidad
-- de origen (minúsculas, sin tildes, romanos finales a dígitos) × pensum × asignatura destino. Cada
-- vez que un asesor APRUEBA un vínculo, ese par suma una confirmación; cada vez que lo QUITA, suma
-- un rechazo. Cuando un par acumula suficientes confirmaciones, el motor lo aplica solo — sin IA.
--
-- Es exactamente la petición: "si el asesor empareja muchas veces Mates X con Mates Y, que el
-- sistema lo aprenda y lo relacione automáticamente".
--
-- Se guardan AMBOS contadores (no un booleano) porque el asesor se corrige: un par que se confirmó
-- 2 veces y se rechazó 5 NO debe aplicarse. El motor exige un mínimo de confirmaciones Y que estas
-- superen a los rechazos.
--
-- Compatible: tabla nueva + función nueva; nada existente cambia.

create table patron_homologacion (
  id uuid primary key default gen_random_uuid(),
  -- Nombre de la unidad de origen ya normalizado (ver normalizarNombre en motor.ts). Es la clave
  -- que permite generalizar entre estudiantes distintos del mismo programa.
  nombre_origen_norm text not null,
  pensum_id uuid not null references pensum (id) on delete cascade,
  asignatura_id uuid not null references asignatura (id) on delete cascade,
  veces_confirmado integer not null default 0,
  veces_rechazado integer not null default 0,
  -- Promedio corrido de la similitud con la que se aprobó el par. Sirve para mostrarle al asesor un
  -- porcentaje coherente con el histórico en vez de un valor fijo inventado.
  similitud_promedio integer,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (nombre_origen_norm, pensum_id, asignatura_id)
);

-- El motor consulta por (pensum, lista de nombres) en batch: este es el índice que sirve esa query.
create index on patron_homologacion (pensum_id, nombre_origen_norm);

comment on table patron_homologacion is 'Aprendizaje por patrones: cuántas veces los asesores confirmaron/rechazaron cada par (nombre de origen normalizado -> asignatura destino). Generaliza decision_matching, que solo acierta con texto idéntico.';

-- Tabla interna del sistema: solo el cliente de servicio (secret key) la toca. RLS activa sin
-- policies = nadie con publishable key puede leerla ni escribirla.
alter table patron_homologacion enable row level security;

-- Registro ATÓMICO de una observación del asesor.
--
-- Va como función (y no como read-modify-write desde la app) porque dos asesores revisando casos a
-- la vez sobre el mismo par se pisarían los contadores: el upsert con expresión los suma en el
-- servidor, dentro de la misma sentencia.
--
-- El promedio de similitud se recalcula de forma incremental sobre las confirmaciones:
--   nuevo_promedio = (promedio_viejo * confirmaciones_viejas + similitud_nueva) / confirmaciones_nuevas
create or replace function registrar_patron_homologacion(
  p_nombre_norm text,
  p_pensum_id uuid,
  p_asignatura_id uuid,
  p_confirmado boolean,
  p_similitud integer default null
) returns void
language sql
as $$
  insert into patron_homologacion as p (
    nombre_origen_norm, pensum_id, asignatura_id,
    veces_confirmado, veces_rechazado, similitud_promedio, actualizado_en
  )
  values (
    p_nombre_norm, p_pensum_id, p_asignatura_id,
    case when p_confirmado then 1 else 0 end,
    case when p_confirmado then 0 else 1 end,
    case when p_confirmado then p_similitud else null end,
    now()
  )
  on conflict (nombre_origen_norm, pensum_id, asignatura_id) do update set
    veces_confirmado = p.veces_confirmado + case when p_confirmado then 1 else 0 end,
    veces_rechazado  = p.veces_rechazado  + case when p_confirmado then 0 else 1 end,
    similitud_promedio = case
      when not p_confirmado or p_similitud is null then p.similitud_promedio
      when p.similitud_promedio is null then p_similitud
      else round(
        ((p.similitud_promedio::numeric * p.veces_confirmado) + p_similitud)
        / (p.veces_confirmado + 1)
      )::integer
    end,
    actualizado_en = now();
$$;

comment on function registrar_patron_homologacion is 'Suma una confirmación o un rechazo del asesor al par (nombre normalizado, pensum, asignatura) de forma atómica, recalculando el promedio de similitud.';
