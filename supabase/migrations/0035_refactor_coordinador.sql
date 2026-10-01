-- Migración 0035 · Refactor flujo coordinador
--
-- Con el nuevo flujo el COORDINADOR (rol = 'asesor') es quien ingresa al sistema el expediente
-- físico del aspirante. Eso requiere:
--   1. Nuevos campos en `caso`  → datos legales del aspirante y campos para la Resolución.
--   2. Nueva tabla `curso_matricula` → las materias que el aspirante debe inscribir (Art. 3°).
--   3. Nuevo campo en `pensum`  → número de resolución MEN del plan de estudios.
--   4. Nuevo campo en `configuracion` → nombre del coordinador elaborador (pie de la Resolución).
--   5. Ampliar la política INSERT de `caso` → el asesor/coordinador ya puede crear casos.
--
-- Todos los ALTER TABLE son retrocompatibles (NULL-able o con DEFAULT).

-- ============================================================================
-- 1. Tabla `caso` — nuevos campos
-- ============================================================================

-- 1a. Identificación legal del aspirante.
--     Se necesita en el encabezado de la Resolución oficial para individualizar al solicitante.
ALTER TABLE caso
  ADD COLUMN solicitante_cedula      text,          -- número de cédula (o pasaporte)
  ADD COLUMN solicitante_lugar_exp   text;           -- ciudad de expedición del documento

-- 1b. Programa académico de procedencia en la IES de origen.
--     El certificado dice la carrera; la guardamos textualmente porque puede ser cualquier nombre.
ALTER TABLE caso
  ADD COLUMN programa_origen_nombre  text;

-- 1c. Campos de la Resolución oficial.
--     numero_resolucion lo digita el vicerrector (no es automático).
--     periodo_matricula indica el período en que el aspirante ingresa, ej. "1P-2026".
--     fecha_limite_pago es la fecha hasta la cual el aspirante puede pagar matrícula.
ALTER TABLE caso
  ADD COLUMN numero_resolucion   text,
  ADD COLUMN periodo_matricula   text,
  ADD COLUMN fecha_limite_pago   date;

-- 1d. Folios de los documentos adjuntos.
--     El Art. 2° de la Resolución lista cuántos folios tiene cada documento.
--     El sistema puede contar desde el PDF, pero el asesor/vicerrector puede corregir el valor.
ALTER TABLE caso
  ADD COLUMN folios_solicitud     smallint,
  ADD COLUMN folios_certificado   smallint,
  ADD COLUMN folios_contenidos    smallint;

-- 1e. Quién creó el caso (coordinador/asesor que lo ingresó al sistema).
--     Se mantiene estudiante_id sin cambios para no romper las policies existentes de RLS.
--     on delete set null: si ese asesor se borra, el caso no desaparece.
ALTER TABLE caso
  ADD COLUMN creado_por_id uuid references perfil(id) on delete set null;

COMMENT ON COLUMN caso.solicitante_cedula    IS 'Número de cédula o pasaporte del aspirante (encabezado Resolución).';
COMMENT ON COLUMN caso.solicitante_lugar_exp IS 'Ciudad de expedición del documento de identidad.';
COMMENT ON COLUMN caso.programa_origen_nombre IS 'Nombre del programa que cursó el aspirante en la IES de origen.';
COMMENT ON COLUMN caso.numero_resolucion     IS 'Número de la Resolución oficial; lo digita el vicerrector.';
COMMENT ON COLUMN caso.periodo_matricula     IS 'Período de ingreso del aspirante, ej. "1P-2026".';
COMMENT ON COLUMN caso.fecha_limite_pago     IS 'Fecha límite para que el aspirante realice el pago de matrícula.';
COMMENT ON COLUMN caso.folios_solicitud      IS 'Número de folios de la solicitud de homologación (Art. 2° Resolución).';
COMMENT ON COLUMN caso.folios_certificado    IS 'Número de folios del certificado de notas (Art. 2° Resolución).';
COMMENT ON COLUMN caso.folios_contenidos     IS 'Número de folios de los contenidos programáticos (Art. 2° Resolución).';
COMMENT ON COLUMN caso.creado_por_id         IS 'Perfil del coordinador/asesor que ingresó el expediente al sistema.';

-- ============================================================================
-- 2. Nueva tabla `curso_matricula` (Artículo 3° de la Resolución)
-- ============================================================================
--
-- Lista las asignaturas que el aspirante DEBE matricular en su primer período
-- (las que NO fueron homologadas). La IA puede sugerir cuáles son; el asesor/
-- vicerrector las confirma antes de emitir la Resolución.

CREATE TABLE curso_matricula (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id       uuid      NOT NULL REFERENCES caso(id) ON DELETE CASCADE,
  asignatura_id uuid      NOT NULL REFERENCES asignatura(id),
  -- Orden de aparición en el listado del Art. 3° (el coordinador puede reordenar)
  orden         smallint  NOT NULL DEFAULT 1,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caso_id, asignatura_id)
);

CREATE INDEX ON curso_matricula(caso_id);

COMMENT ON TABLE  curso_matricula              IS 'Asignaturas que el aspirante debe matricular en su primer período (Art. 3° Resolución).';
COMMENT ON COLUMN curso_matricula.orden        IS 'Orden de aparición en el Art. 3°; permite al coordinador ajustar la secuencia.';

-- RLS para `curso_matricula`
ALTER TABLE curso_matricula ENABLE ROW LEVEL SECURITY;

-- admin y asesor asignado: lectura + escritura completa
CREATE POLICY "Admin o asesor asignado gestiona curso_matricula" ON curso_matricula
  FOR ALL TO authenticated
  USING (
    es_admin()
    OR (es_asesor() AND EXISTS (
      SELECT 1 FROM caso
      WHERE caso.id = curso_matricula.caso_id
        AND caso.asesor_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    es_admin()
    OR (es_asesor() AND EXISTS (
      SELECT 1 FROM caso
      WHERE caso.id = curso_matricula.caso_id
        AND caso.asesor_id = (SELECT auth.uid())
    ))
  );

-- verificador: solo lectura (los casos aprobados que le corresponden ver)
CREATE POLICY "Verificador ve curso_matricula" ON curso_matricula
  FOR SELECT TO authenticated
  USING (
    es_verificador() AND EXISTS (
      SELECT 1 FROM caso
      WHERE caso.id = curso_matricula.caso_id
        AND caso.estado = 'aprobado'
    )
  );

-- ============================================================================
-- 3. Tabla `pensum` — resolución MEN del plan de estudios
-- ============================================================================
--
-- La Resolución de homologación debe citar el acto administrativo del MEN que
-- aprobó el plan de estudios destino. Ej.: "No. 1234 de 2021".

ALTER TABLE pensum
  ADD COLUMN resolucion_men text;

COMMENT ON COLUMN pensum.resolucion_men IS 'Número de resolución del MEN que aprueba el plan, ej. "No. 1234 de 2021".';

-- ============================================================================
-- 4. Tabla `configuracion` — nombre del coordinador elaborador
-- ============================================================================
--
-- El pie de la Resolución lleva "Elaboró: <nombre del coordinador>".
-- Se almacena aquí para que el admin lo configure una sola vez y aparezca
-- automáticamente en todos los documentos generados.

ALTER TABLE configuracion
  ADD COLUMN coordinador_nombre text;

COMMENT ON COLUMN configuracion.coordinador_nombre IS 'Nombre del coordinador que aparece en el pie de la Resolución ("Elaboró:").';

-- ============================================================================
-- 5. RLS `caso` — permitir al asesor/coordinador CREAR casos
-- ============================================================================
--
-- Antes solo el propio estudiante (estudiante_id = auth.uid()) o el admin
-- podían hacer INSERT en `caso`. Con el nuevo flujo el coordinador ingresa
-- el expediente físico al sistema, por lo que el asesor también debe poder
-- crear casos. Cuando el asesor crea un caso:
--   • Rellena `asesor_id` con su propio id → las policies de SELECT/UPDATE del
--     asesor ya funcionan (él ve los casos donde asesor_id = auth.uid()).
--   • Rellena `creado_por_id` con su propio id → auditoría de quién lo ingresó.
--   • estudiante_id puede ser el perfil del aspirante si ya existe, o NULL si
--     aún no se ha registrado (ver política de referencia).

DROP POLICY "Crear mi caso" ON caso;

CREATE POLICY "Crear mi caso" ON caso
  FOR INSERT TO authenticated
  WITH CHECK (
    -- El propio estudiante crea su caso en línea
    estudiante_id = (SELECT auth.uid())
    -- El admin puede crear cualquier caso
    OR es_admin()
    -- El coordinador (rol asesor) ingresa el expediente físico
    OR es_asesor()
  );

COMMENT ON TABLE curso_matricula IS
  'Asignaturas a matricular en primer período (Art. 3° Resolución). '
  'La IA las sugiere; el asesor/vicerrector las confirma antes de emitir la Resolución.';
