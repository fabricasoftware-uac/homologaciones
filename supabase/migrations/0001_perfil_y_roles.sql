-- Migración 0001 · Perfiles y roles de usuario
--
-- Supabase Auth guarda el login (email y clave) de cada usuario en su propio esquema privado
-- (auth.users), pero ahí no podemos meter datos nuestros como el nombre para mostrar o si la
-- persona es estudiante o admin. Para eso creamos la tabla `perfil` en el esquema público:
-- una fila por usuario, enlazada 1:1 con auth.users.

-- Los dos únicos roles del sistema. Lo dejamos como enum (y no como texto libre) para que la
-- base de datos rechace de raíz cualquier valor que no sea exactamente uno de estos dos.
create type rol_usuario as enum ('estudiante', 'admin');

create table perfil (
  -- Mismo id que el usuario en Auth. Si se elimina la cuenta, su perfil se borra en cascada.
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  -- Todos entran como estudiante. A los admins los promovemos a mano (más adelante, desde un
  -- panel interno); nunca se asigna ese rol solo al registrarse.
  rol rol_usuario not null default 'estudiante',
  creado_en timestamptz not null default now()
);

-- Al registrarse, Supabase Auth crea la fila en auth.users, pero NO en nuestra tabla perfil.
-- Este trigger cierra ese hueco: por cada usuario nuevo crea su perfil automáticamente y le
-- copia el nombre que el formulario de registro mandó como metadata (lo conectamos en el Bloque 5).
create function crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre')
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row
  execute function crear_perfil_para_usuario_nuevo();

-- RLS (seguridad a nivel de fila): sin esto, cualquiera con la publishable key podría leer
-- todos los perfiles. Al activarla, por defecto NADIE ve nada hasta que una policy lo permita.
alter table perfil enable row level security;

-- Por ahora cada quien solo ve y edita SU propio perfil. El "admin ve todos los perfiles" lo
-- sumaremos después con una función security definer, para evitar la recursión de RLS que
-- aparece si una policy de perfil tuviera que volver a consultar perfil para averiguar el rol.
-- El (select auth.uid()) entre paréntesis es la forma recomendada por Supabase: evalúa el id
-- del usuario una sola vez por consulta en vez de fila por fila.
create policy "Ver mi propio perfil"
  on perfil for select
  using ((select auth.uid()) = id);

create policy "Editar mi propio perfil"
  on perfil for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
