
-- ============================================================
-- Enums
-- ============================================================
create type public.proyecto_estado as enum ('nuevo','en_proceso','en_revision','completado','cerrado');
create type public.miembro_rol as enum ('implementador','invitado');
create type public.miembro_estado as enum ('activo','inhabilitado');
create type public.modulo_estado as enum ('sin_iniciar','en_diligenciamiento','en_revision','con_observaciones','aprobado');
create type public.comportamiento_vencimiento as enum ('bloquear','editable_avisar','solo_avisar','extension_implementador');
create type public.invitacion_rol as enum ('implementador','invitado');
create type public.invitacion_estado as enum ('pendiente','aceptada','revocada','expirada');
create type public.observacion_estado as enum ('abierta','resuelta');

-- ============================================================
-- Helper: updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- proyectos
-- ============================================================
create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text not null,
  estado public.proyecto_estado not null default 'nuevo',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.proyectos to authenticated;
grant all on public.proyectos to service_role;
alter table public.proyectos enable row level security;
create trigger trg_proyectos_updated
  before update on public.proyectos
  for each row execute function public.set_updated_at();

-- ============================================================
-- proyecto_miembros
-- ============================================================
create table public.proyecto_miembros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rol_en_proyecto public.miembro_rol not null,
  estado public.miembro_estado not null default 'activo',
  created_at timestamptz not null default now(),
  unique (proyecto_id, profile_id, rol_en_proyecto)
);
grant select, insert, update, delete on public.proyecto_miembros to authenticated;
grant all on public.proyecto_miembros to service_role;
alter table public.proyecto_miembros enable row level security;
create index idx_pm_proyecto on public.proyecto_miembros(proyecto_id);
create index idx_pm_profile on public.proyecto_miembros(profile_id);

-- ============================================================
-- proyecto_modulos
-- ============================================================
create table public.proyecto_modulos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  modulo_key text not null check (modulo_key in ('imagen','sociedades','seguridad')),
  estado public.modulo_estado not null default 'sin_iniciar',
  fecha_limite date,
  comportamiento_vencimiento public.comportamiento_vencimiento,
  datos jsonb not null default '{}'::jsonb,
  progreso int not null default 0 check (progreso between 0 and 100),
  enviado_at timestamptz,
  enviado_por uuid references public.profiles(id) on delete set null,
  revisado_at timestamptz,
  revisado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, modulo_key)
);
grant select, insert, update, delete on public.proyecto_modulos to authenticated;
grant all on public.proyecto_modulos to service_role;
alter table public.proyecto_modulos enable row level security;
create index idx_pmod_proyecto on public.proyecto_modulos(proyecto_id);
create trigger trg_modulos_updated
  before update on public.proyecto_modulos
  for each row execute function public.set_updated_at();

-- ============================================================
-- invitaciones
-- ============================================================
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  rol_invitado public.invitacion_rol not null,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  token text not null unique,
  expira_at timestamptz not null,
  estado public.invitacion_estado not null default 'pendiente',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
grant select, insert, update, delete on public.invitaciones to authenticated;
grant all on public.invitaciones to service_role;
-- La validación pública del token se hace por función SECURITY DEFINER,
-- por lo que anon requiere permiso de ejecución (más abajo). No se le
-- otorga acceso directo a la tabla.
alter table public.invitaciones enable row level security;
create index idx_inv_token on public.invitaciones(token);
create index idx_inv_email on public.invitaciones(email);

create or replace function public.invitaciones_check_proyecto()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.rol_invitado = 'invitado' and new.proyecto_id is null then
    raise exception 'Una invitación de tipo invitado requiere proyecto_id';
  end if;
  return new;
end;
$$;
create trigger trg_invitaciones_check
  before insert or update on public.invitaciones
  for each row execute function public.invitaciones_check_proyecto();

-- ============================================================
-- observaciones
-- ============================================================
create table public.observaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_modulo_id uuid not null references public.proyecto_modulos(id) on delete cascade,
  campo_key text not null,
  comentario text not null,
  estado public.observacion_estado not null default 'abierta',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resuelta_at timestamptz
);
grant select, insert, update, delete on public.observaciones to authenticated;
grant all on public.observaciones to service_role;
alter table public.observaciones enable row level security;
create index idx_obs_modulo on public.observaciones(proyecto_modulo_id);

-- ============================================================
-- actas
-- ============================================================
create table public.actas (
  id uuid primary key default gen_random_uuid(),
  proyecto_modulo_id uuid not null references public.proyecto_modulos(id) on delete cascade,
  archivo_url text not null,
  version int not null default 1,
  generada_at timestamptz not null default now(),
  generada_por uuid references public.profiles(id) on delete set null
);
grant select, insert, update, delete on public.actas to authenticated;
grant all on public.actas to service_role;
alter table public.actas enable row level security;
create index idx_actas_modulo on public.actas(proyecto_modulo_id);

-- ============================================================
-- archivos
-- ============================================================
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  proyecto_modulo_id uuid references public.proyecto_modulos(id) on delete cascade,
  campo_key text,
  nombre_original text not null,
  storage_path text not null,
  tipo text,
  tamano int,
  dimensiones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.archivos to authenticated;
grant all on public.archivos to service_role;
alter table public.archivos enable row level security;
create index idx_arch_modulo on public.archivos(proyecto_modulo_id);

-- ============================================================
-- Funciones de seguridad
-- ============================================================

-- ¿Es miembro activo del proyecto?
create or replace function public.is_project_member(_uid uuid, _proyecto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.proyecto_miembros
    where proyecto_id = _proyecto_id
      and profile_id = _uid
      and estado = 'activo'
  );
$$;

-- ¿Puede el usuario editar el módulo? (regla de bloqueo por estado para invitados)
create or replace function public.puede_editar_modulo(_uid uuid, _modulo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role(_uid, 'admin') or public.has_role(_uid, 'implementador') then true
    else exists (
      select 1
      from public.proyecto_modulos m
      where m.id = _modulo_id
        and m.estado in ('sin_iniciar','en_diligenciamiento','con_observaciones')
        and public.is_project_member(_uid, m.proyecto_id)
    )
  end;
$$;

-- Correos destinatarios de notificaciones/actas para un proyecto.
create or replace function public.destinatarios_notificacion(_proyecto_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
    from public.profiles p
    where p.rol in ('admin','implementador') and p.estado = 'activo'
  union
  select p.email
    from public.profiles p
    join public.proyecto_miembros pm on pm.profile_id = p.id
    where pm.proyecto_id = _proyecto_id
      and pm.rol_en_proyecto = 'invitado'
      and pm.estado = 'activo'
      and p.estado = 'activo';
$$;

-- Validar invitación por token (pública, un solo uso, con expiración).
create or replace function public.validar_invitacion(_token text)
returns table (
  email text,
  rol_invitado public.invitacion_rol,
  proyecto_id uuid,
  proyecto_nombre text,
  expira_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.rol_invitado, i.proyecto_id, p.nombre, i.expira_at
    from public.invitaciones i
    left join public.proyectos p on p.id = i.proyecto_id
   where i.token = _token
     and i.estado = 'pendiente'
     and i.expira_at > now()
   limit 1;
$$;

-- Helper para políticas de storage: extraer proyecto_id del primer segmento del path.
create or replace function public.storage_proyecto_from_path(_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare v uuid;
begin
  begin
    v := split_part(_name, '/', 1)::uuid;
  exception when others then
    return null;
  end;
  return v;
end;
$$;

-- Revocar acceso a anon salvo la validación pública de invitaciones.
revoke execute on function public.is_project_member(uuid, uuid) from anon, public;
revoke execute on function public.puede_editar_modulo(uuid, uuid) from anon, public;
revoke execute on function public.destinatarios_notificacion(uuid) from anon, public;
revoke execute on function public.validar_invitacion(text) from public;
grant execute on function public.validar_invitacion(text) to anon, authenticated;

-- ============================================================
-- Auto-completar proyecto cuando todos los módulos son aprobados
-- ============================================================
create or replace function public.autocompletar_proyecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_pendientes int;
begin
  if new.estado = 'aprobado' then
    select count(*) into v_pendientes
      from public.proyecto_modulos
      where proyecto_id = new.proyecto_id and estado <> 'aprobado';
    if v_pendientes = 0 then
      update public.proyectos
         set estado = 'completado'
       where id = new.proyecto_id
         and estado <> 'cerrado';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_autocompletar_proyecto
  after update of estado on public.proyecto_modulos
  for each row execute function public.autocompletar_proyecto();

-- ============================================================
-- RLS Policies
-- ============================================================

-- proyectos
create policy proyectos_select on public.proyectos for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or public.is_project_member(auth.uid(), id)
  );
create policy proyectos_insert on public.proyectos for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  );
create policy proyectos_update on public.proyectos for update to authenticated
  using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  )
  with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  );
create policy proyectos_delete on public.proyectos for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- proyecto_miembros
create policy pm_select on public.proyecto_miembros for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or profile_id = auth.uid()
  );
create policy pm_insert on public.proyecto_miembros for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  );
create policy pm_update on public.proyecto_miembros for update to authenticated
  using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  )
  with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  );
create policy pm_delete on public.proyecto_miembros for delete to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));

-- proyecto_modulos
create policy pmod_select on public.proyecto_modulos for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or public.is_project_member(auth.uid(), proyecto_id)
  );
create policy pmod_insert on public.proyecto_modulos for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador')
  );
create policy pmod_update on public.proyecto_modulos for update to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or (
      public.is_project_member(auth.uid(), proyecto_id)
      and estado in ('sin_iniciar','en_diligenciamiento','con_observaciones')
    )
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or (
      public.is_project_member(auth.uid(), proyecto_id)
      and estado in ('sin_iniciar','en_diligenciamiento','con_observaciones')
    )
  );
create policy pmod_delete on public.proyecto_modulos for delete to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));

-- invitaciones (gestión interna)
create policy inv_select on public.invitaciones for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy inv_insert on public.invitaciones for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy inv_update on public.invitaciones for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy inv_delete on public.invitaciones for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- observaciones
create policy obs_select on public.observaciones for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or exists (
      select 1 from public.proyecto_modulos m
      where m.id = proyecto_modulo_id
        and public.is_project_member(auth.uid(), m.proyecto_id)
    )
  );
create policy obs_insert on public.observaciones for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy obs_update on public.observaciones for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy obs_delete on public.observaciones for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- actas
create policy actas_select on public.actas for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or exists (
      select 1 from public.proyecto_modulos m
      where m.id = proyecto_modulo_id
        and public.is_project_member(auth.uid(), m.proyecto_id)
    )
  );
create policy actas_insert on public.actas for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy actas_update on public.actas for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy actas_delete on public.actas for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- archivos
create policy arch_select on public.archivos for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or (
      proyecto_modulo_id is not null
      and exists (
        select 1 from public.proyecto_modulos m
        where m.id = proyecto_modulo_id
          and public.is_project_member(auth.uid(), m.proyecto_id)
      )
    )
  );
create policy arch_insert on public.archivos for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or (
      proyecto_modulo_id is not null
      and public.puede_editar_modulo(auth.uid(), proyecto_modulo_id)
    )
  );
create policy arch_update on public.archivos for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));
create policy arch_delete on public.archivos for delete to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'implementador'));

-- ============================================================
-- Storage: políticas para los buckets del proyecto
-- Estructura de path: {proyecto_id}/...
-- ============================================================
create policy storage_egixia_select on storage.objects for select to authenticated
  using (
    bucket_id in ('logos-clientes','documentos','actas')
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
      or public.is_project_member(auth.uid(), public.storage_proyecto_from_path(name))
    )
  );
create policy storage_egixia_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('logos-clientes','documentos','actas')
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
      or public.is_project_member(auth.uid(), public.storage_proyecto_from_path(name))
    )
  );
create policy storage_egixia_update on storage.objects for update to authenticated
  using (
    bucket_id in ('logos-clientes','documentos','actas')
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
      or public.is_project_member(auth.uid(), public.storage_proyecto_from_path(name))
    )
  );
create policy storage_egixia_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('logos-clientes','documentos','actas')
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
    )
  );
