-- Migración 0026 · Motor de decisión en cascada (FASE 7)
--
-- Dos piezas que convierten el matching en un proceso de COSTO DECRECIENTE:
--
--   1. caso.hash_documento: huella sha256 del PDF. Si llega un documento que YA se procesó (mismo
--      certificado reenviado, o el mismo programa del SENA que comparten miles de estudiantes), se
--      REUTILIZAN sus unidades extraídas y embeddings: 0 tokens de extracción.
--
--   2. decision_matching: caché de DECISIONES de emparejamiento. La clave es (hash de la unidad de
--      origen × pensum destino): la decisión "¿qué asignaturas de este pensum cubre esta competencia?"
--      es la MISMA para todos los estudiantes que traigan esa competencia. El primer caso paga la
--      llamada a la IA; los siguientes la leen del caché (0 tokens). También guarda decisiones
--      NEGATIVAS (vinculos = []): "ya sabemos que esta unidad no homologa nada aquí" evita re-preguntar.
--
-- fuente: quién produjo la decisión — 'ia' (LLM), 'regla' (igualdad de nombre) o, a futuro, 'admin'
-- (cuando la revisión humana retroalimente el caché, Fase 8).
--
-- Compatible: tabla nueva + columna nullable; nada existente cambia.

alter table caso add column hash_documento text;
create index on caso (hash_documento);

comment on column caso.hash_documento is 'sha256 del PDF del certificado. Permite reutilizar la extracción de documentos ya procesados.';

create table decision_matching (
  id uuid primary key default gen_random_uuid(),
  hash_unidad text not null,       -- sha256 del texto_embedding de la unidad de origen
  pensum_id uuid not null references pensum (id) on delete cascade,
  -- Decisión completa para esa unidad contra ese pensum: [{asignatura_id, similitud, razon}].
  -- Vacío = decisión negativa ("no homologa nada de este pensum"), también cacheable.
  vinculos jsonb not null default '[]'::jsonb,
  fuente text not null default 'ia', -- 'ia' | 'regla' | 'admin' (futuro)
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (hash_unidad, pensum_id)
);
create index on decision_matching (pensum_id);

comment on table decision_matching is 'Fase 7: caché de decisiones de emparejamiento por (unidad de origen × pensum). El primer caso paga la IA; los siguientes leen de aquí.';

-- Tabla interna del sistema: solo el cliente de servicio (secret key) la toca. RLS activa sin
-- policies = nadie con publishable key puede leerla ni escribirla.
alter table decision_matching enable row level security;
