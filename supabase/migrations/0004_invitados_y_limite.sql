-- Migración 0004 · Invitados (sesión anónima) + tope de homologaciones por día
--
-- Cambio de producto: el estudiante YA NO se registra. Quien quiera homologar entra como INVITADO
-- (sesión anónima de Supabase) y envía su caso sin crear cuenta. El único rol que inicia sesión es
-- el admin. Para que esto no se preste al abuso, limitamos a 5 homologaciones por día, contadas
-- tanto por IP como por sesión de invitado.

-- ============================================================================
-- 1. El perfil del invitado se llama "Invitado".
-- ============================================================================
-- El invitado entra con auth.signInAnonymously(): Supabase crea su fila en auth.users con
-- is_anonymous = true y SIN metadata de nombre. Ajustamos el trigger para que, en ese caso, el
-- perfil quede como "Invitado" en lugar de "Sin nombre". Los registros normales (el admin) siguen
-- tomando el nombre de la metadata como antes.
create or replace function crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (id, nombre)
  values (
    new.id,
    case
      when new.is_anonymous then 'Invitado'
      else coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre')
    end
  );
  return new;
end;
$$;

-- ============================================================================
-- 2. IP del solicitante en el caso (para el tope por IP).
-- ============================================================================
-- Guardamos la IP HASHEADA (sha256, la calcula el servidor), no en claro: sirve igual para contar
-- cuántos casos salieron de la misma IP sin almacenar el dato personal tal cual.
alter table caso add column ip_solicitante text;
create index on caso (ip_solicitante, creado_en);

-- ============================================================================
-- 3. Conteo de homologaciones recientes (para el límite diario).
-- ============================================================================
-- El tope por IP exige contar casos de OTROS invitados con la misma IP, pero la RLS de `caso` solo
-- deja ver los propios. Por eso esta función es security definer: cuenta saltándose la RLS. El
-- conteo por usuario usa auth.uid() (que sí funciona dentro de una función definer: lee el JWT del
-- request). Devuelve ambos números para que el servidor decida y dé un mensaje preciso.
create function contar_homologaciones_recientes(ip_param text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'por_ip', (
      select count(*) from public.caso
      where ip_solicitante = ip_param
        and creado_en > now() - interval '24 hours'
    ),
    'por_usuario', (
      select count(*) from public.caso
      where estudiante_id = auth.uid()
        and creado_en > now() - interval '24 hours'
    )
  );
$$;
