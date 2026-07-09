-- ── Roles nuevos: asesor y verificador ──
--
-- asesor: revisa y decide SOLO los casos que el admin le asigne (caso.asesor_id).
-- verificador: ve los casos APROBADOS para gestionar la inscripción del estudiante (contacto,
--              matrícula de materias) sin poder tocar la revisión.
--
-- Va en su propia migración: un valor nuevo de enum no puede usarse (en policies, updates, etc.)
-- dentro de la misma transacción que lo crea; la 0029 ya lo usa con el valor commiteado.
alter type rol_usuario add value if not exists 'asesor';
alter type rol_usuario add value if not exists 'verificador';
