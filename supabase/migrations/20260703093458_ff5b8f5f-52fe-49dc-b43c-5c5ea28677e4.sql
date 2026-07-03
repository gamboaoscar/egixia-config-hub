create or replace function public.is_project_member(_uid uuid, _proyecto_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select _uid = auth.uid()
    and exists (
      select 1
      from public.proyecto_miembros
      where proyecto_id = _proyecto_id
        and profile_id = auth.uid()
        and estado = 'activo'::public.miembro_estado
    );
$$;

create or replace function public.puede_editar_modulo(_uid uuid, _modulo_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select _uid = auth.uid()
    and case
      when public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'implementador'::public.app_role)
      then true
      else exists (
        select 1
        from public.proyecto_modulos m
        where m.id = _modulo_id
          and m.estado in ('sin_iniciar','en_diligenciamiento','con_observaciones')
          and public.is_project_member(auth.uid(), m.proyecto_id)
      )
    end;
$$;

revoke execute on function public.is_project_member(uuid, uuid) from public, anon;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;

revoke execute on function public.puede_editar_modulo(uuid, uuid) from public, anon;
grant execute on function public.puede_editar_modulo(uuid, uuid) to authenticated;