
-- Enums
create type public.app_role as enum ('admin', 'implementador', 'cliente');
create type public.user_estado as enum ('activo', 'inhabilitado');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  apellido text not null default '',
  email text not null,
  foto_perfil text,
  cargo text,
  empresa text,
  rol public.app_role not null default 'cliente',
  estado public.user_estado not null default 'activo',
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- Security-definer role check
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and rol = _role
  );
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Policies for profiles
create policy "profiles_select_own_or_privileged" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'implementador')
  );

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profiles_delete_admin_only" on public.profiles
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "profiles_insert_admin_only" on public.profiles
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Trigger: prevent non-admins from changing email/rol/estado on their own profile
create or replace function public.profiles_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := public.has_role(auth.uid(), 'admin');
  if not v_is_admin then
    if new.email is distinct from old.email then
      raise exception 'No puedes modificar tu correo';
    end if;
    if new.rol is distinct from old.rol then
      raise exception 'No puedes modificar tu rol';
    end if;
    if new.estado is distinct from old.estado then
      raise exception 'No puedes modificar tu estado';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_before_update
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_fields();

-- Auditoria
create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create index auditoria_created_at_idx on public.auditoria (created_at desc);
create index auditoria_actor_idx on public.auditoria (actor_id);

grant select, insert on public.auditoria to authenticated;
grant all on public.auditoria to service_role;

alter table public.auditoria enable row level security;

create policy "auditoria_select_privileged" on public.auditoria
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'implementador')
  );

create policy "auditoria_insert_self" on public.auditoria
  for insert to authenticated
  with check (actor_id = auth.uid());

-- Helper to insert audit records
create or replace function public.registrar_auditoria(
  _accion text,
  _entidad text,
  _entidad_id text,
  _detalle jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), _accion, _entidad, _entidad_id, _detalle)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.registrar_auditoria(text, text, text, jsonb) to authenticated;
