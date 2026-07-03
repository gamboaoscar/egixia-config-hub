create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select _user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and rol = _role
        and estado = 'activo'::public.user_estado
    );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;