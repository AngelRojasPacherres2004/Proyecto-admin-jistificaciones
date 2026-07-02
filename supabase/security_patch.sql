-- Ejecutar una vez en Supabase > SQL Editor si schema.sql se aplicó antes
-- de la corrección de seguridad del alta de usuarios.
--
-- Ningún usuario puede elegir su propio rol mediante user_metadata.
-- Las promociones a administrador se realizan exclusivamente desde el backend.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'Usuario'), '@', 1)
    ),
    'user'::public.app_role
  );
  return new;
end;
$$;
