drop policy if exists profiles_select_own_or_privileged on public.profiles;
drop policy if exists profiles_insert_admin_only on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_delete_admin_only on public.profiles;

create policy profiles_select_self on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_select_admin_implementador on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles current_profile
    where current_profile.id = auth.uid()
      and current_profile.rol in ('admin'::public.app_role, 'implementador'::public.app_role)
      and current_profile.estado = 'activo'::public.user_estado
  )
);

create policy profiles_select_project_peers on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.proyecto_miembros ma
    join public.proyecto_miembros mb on mb.proyecto_id = ma.proyecto_id
    where ma.profile_id = auth.uid()
      and mb.profile_id = profiles.id
      and ma.estado = 'activo'::public.miembro_estado
      and mb.estado = 'activo'::public.miembro_estado
  )
);

create policy profiles_insert_admin_only on public.profiles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy profiles_update_admin on public.profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy profiles_update_self on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and rol = (select p.rol from public.profiles p where p.id = auth.uid())
  and estado = (select p.estado from public.profiles p where p.id = auth.uid())
  and email = (select p.email from public.profiles p where p.id = auth.uid())
);

create policy profiles_delete_admin_only on public.profiles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));