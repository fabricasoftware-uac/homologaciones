-- Migración 0017 · Calidad de la homologación con IA
--
-- Dos campos para que el estudio sea más confiable y explicable:
--
--   1. configuracion.nota_minima: la nota mínima de origen (escala 0–5, estándar colombiano) que se
--      considera "aprobada" para homologar. El estudio AVISA cuando un vínculo está por debajo —no
--      bloquea: la decisión sigue siendo del admin—. Configurable en /configuracion.
--
--   2. vinculo.razon: la justificación corta que da la IA al emparejar dos materias ("ambas cubren
--      cálculo diferencial e integral"). Se muestra en el estudio para que el admin entienda y
--      confíe en la sugerencia sin adivinar. Nullable: los vínculos viejos (y los hechos a mano por
--      el admin) no la tienen.

alter table configuracion add column nota_minima numeric(3, 1) not null default 3.0;

alter table vinculo add column razon text;
