-- Migración 0009 · Datos de contacto del invitado en el caso
--
-- Antes el invitado enviaba su homologación de forma totalmente anónima y no había manera de
-- contactarlo con el resultado. Ahora deja sus datos al enviar: con ellos el admin puede escribirle
-- (correo) o llamarlo (celular) cuando revisa el caso, y el sistema le avisa el veredicto por correo.
--
-- Son nullable porque los casos creados ANTES de este cambio no los tienen; la obligatoriedad la
-- exige el formulario y la server action, no la base.
alter table caso add column solicitante_nombre text;
alter table caso add column solicitante_celular text;
alter table caso add column solicitante_correo text;
