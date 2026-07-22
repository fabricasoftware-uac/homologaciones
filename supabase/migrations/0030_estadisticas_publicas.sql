-- Migracion 0030 · RPC publica de estadisticas agregadas para el dashboard del estudiante
--
-- El dashboard de /homologar muestra metricas clave a visitantes sin sesion (anon).
-- Como la tabla caso esta protegida por RLS y los campos decidido_en / decidido_por
-- son del admin, exponemos los datos mediante una funcion SECURITY DEFINER que el
-- cliente de servicio puede llamar.
--
-- Devuelve un jsonb con:
--   total_casos, total_aprobados, total_rechazados,
--   tiempo_promedio_horas, carreras_disponibles, top_carreras

create or replace function public.obtener_estadisticas_publicas()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'total_casos', (select count(*) from public.caso),
    'total_aprobados', (select count(*) from public.caso where estado = 'aprobado'),
    'total_rechazados', (select count(*) from public.caso where estado = 'rechazado'),
    'tiempo_promedio_horas', (
      select round(avg(extract(epoch from (decidido_en - creado_en)) / 3600)::numeric, 1)
      from public.caso
      where decidido_en is not null
    ),
    'carreras_disponibles', (select count(*) from public.pensum where activo = true),
    'top_carreras', (
      select coalesce(jsonb_agg(
        jsonb_build_object('carrera', sub.carrera, 'cantidad', sub.cantidad)
        order by sub.cantidad desc
      ), '[]'::jsonb)
      from (
        select p.carrera, count(c.id) as cantidad
        from public.caso c
        join public.pensum p on p.id = c.pensum_destino_id
        group by p.carrera
        order by cantidad desc
        limit 5
      ) sub
    )
  ) into resultado;

  return resultado;
end;
$$;