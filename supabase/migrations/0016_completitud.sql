-- Migración 0016 · Campos base para completitud (legal, recuperación, auditoría)
--
-- Esta migración abre la puerta a cuatro frentes que el caso todavía no soportaba. No agrega lógica:
-- solo las columnas que las próximas fases van a usar. Todo es nullable / con default para no romper
-- los casos ya existentes.
--
--   1. Recuperación del invitado: token_seguimiento. El estudiante entra ANÓNIMO; si pierde la
--      sesión, este token (enviado por correo) le deja volver a su caso sin registrarse.
--   2. Auditoría del veredicto: decidido_en / decidido_por. Cuándo y qué admin cerró el caso, para
--      medir tiempo de respuesta y dejar rastro de quién decidió.
--   3. Nota interna: nota_interna. Hasta hoy nota_admin era la única nota y se la llevaba el
--      estudiante; ahora nota_admin es la nota PARA el estudiante y nota_interna es de uso interno.
--   4. Habeas Data (Ley 1581): autorizo_datos / autorizo_en. Deja constancia de que el solicitante
--      autorizó el tratamiento de sus datos al enviar.

-- 1. Token de seguimiento. Default para que los casos nuevos lo traigan solos; backfill para los
--    viejos. Único e indexado porque es la llave por la que se consulta el caso sin sesión.
alter table caso add column token_seguimiento uuid not null default gen_random_uuid();
update caso set token_seguimiento = gen_random_uuid() where token_seguimiento is null;
create unique index caso_token_seguimiento_idx on caso (token_seguimiento);

-- 2. Auditoría del veredicto. decidido_por apunta al perfil del admin; on delete set null para no
--    perder el caso si algún día se borra ese admin.
alter table caso add column decidido_en timestamptz;
alter table caso add column decidido_por uuid references perfil(id) on delete set null;

-- 3. Nota interna (no viaja al estudiante ni al acta).
alter table caso add column nota_interna text;

-- 4. Constancia de autorización de tratamiento de datos.
alter table caso add column autorizo_datos boolean not null default false;
alter table caso add column autorizo_en timestamptz;
