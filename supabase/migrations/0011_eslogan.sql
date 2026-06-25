-- Migración 0011 · Eslogan de la institución (personalización del login)
--
-- Una frase corta que la institución muestra en la pantalla de ingreso, bajo su nombre. Profundiza
-- el white-label: el login ahora también se configura desde el panel. El default backfillea la fila
-- existente.
alter table configuracion add column eslogan text not null default 'Sistema de homologaciones académicas';
