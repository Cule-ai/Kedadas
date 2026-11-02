-- =========================================================================
-- ESQUEMA PROFESIONAL KEDADAS: PRIVACIDAD ESTRICTA (RLS) & SISTEMA DE GRUPOS
-- Compatible con Supabase PostgreSQL 15+ y Supabase Auth
-- =========================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- =========================================================================
-- SECCIÓN 1: SISTEMA DE GRUPOS PRIVADOS (Zero-Visibility para no miembros)
-- =========================================================================

-- Tabla principal de grupos
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Tabla de membresía y roles en grupos
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_group_user unique (group_id, user_id)
);

-- Índices de alto rendimiento para RLS y cruces
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_members_group on public.group_members(group_id);
create index if not exists idx_groups_created_by on public.groups(created_by);

-- =========================================================================
-- FUNCIONES AUXILIARES (SECURITY DEFINER) PARA PREVENIR RECURSIÓN INFINITA EN RLS
-- =========================================================================

-- Comprueba si el usuario pertenece al grupo sin disparar bucles de RLS
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
  );
$$;

-- Comprueba si el usuario es administrador del grupo
create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and role = 'admin'
  );
$$;

-- Trigger: Cuando un usuario crea un grupo, se le asigna automáticamente el rol 'admin'
create or replace function public.handle_group_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_group_creator();

-- =========================================================================
-- RLS (ROW LEVEL SECURITY) PARA GRUPOS Y MIEMBROS
-- =========================================================================
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- POLÍTICAS: groups
-- 1. SELECT: Solo visible si el usuario autenticado es miembro del grupo
create policy "groups_select_members_only"
  on public.groups
  for select
  to authenticated
  using (public.is_group_member(id, auth.uid()));

-- 2. INSERT: Cualquier usuario autenticado puede crear un grupo
create policy "groups_insert_authenticated"
  on public.groups
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- 3. UPDATE: Solo los administradores del grupo pueden modificar datos
create policy "groups_update_admin_only"
  on public.groups
  for update
  to authenticated
  using (public.is_group_admin(id, auth.uid()))
  with check (public.is_group_admin(id, auth.uid()));

-- 4. DELETE: Solo el administrador puede disolver (eliminar) el grupo
create policy "groups_delete_admin_only"
  on public.groups
  for delete
  to authenticated
  using (public.is_group_admin(id, auth.uid()));

-- POLÍTICAS: group_members
-- 1. SELECT: Solo los miembros del grupo pueden ver a sus compañeros
create policy "group_members_select_peer_members"
  on public.group_members
  for select
  to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- 2. INSERT: El admin del grupo puede invitar/añadir miembros (o el usuario unirse)
create policy "group_members_insert_admin_or_self"
  on public.group_members
  for insert
  to authenticated
  with check (
    public.is_group_admin(group_id, auth.uid())
    or user_id = auth.uid()
  );

-- 3. UPDATE: Solo el admin puede promover/degradar roles
create policy "group_members_update_admin_only"
  on public.group_members
  for update
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

-- 4. DELETE: Un miembro puede abandonar el grupo, o el admin expulsar a un miembro
create policy "group_members_delete_self_or_admin"
  on public.group_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_admin(group_id, auth.uid())
  );

-- =========================================================================
-- SECCIÓN 2: PRIVACIDAD DE HORARIOS (schedules & schedule_permissions)
-- =========================================================================

-- Tabla de horarios individuales
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  shift_type text not null, -- 'M' (Mañana), 'T' (Tarde), 'N' (Noche), 'L' (Libre), 'V' (Vacaciones)
  is_free boolean not null default false, -- true si shift_type = 'L'
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_user_date unique (user_id, date)
);

-- Tabla de permisos explícitos de visualización
create table if not exists public.schedule_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_owner_viewer unique (owner_id, viewer_id),
  constraint no_self_permission check (owner_id <> viewer_id)
);

-- Índices para búsqueda ultrarrápida
create index if not exists idx_schedules_user_date on public.schedules(user_id, date);
create index if not exists idx_schedules_free_date on public.schedules(date) where is_free = true;
create index if not exists idx_schedule_perms_owner on public.schedule_permissions(owner_id);
create index if not exists idx_schedule_perms_viewer on public.schedule_permissions(viewer_id);

-- =========================================================================
-- RLS PARA HORARIOS Y PERMISOS
-- =========================================================================
alter table public.schedules enable row level security;
alter table public.schedule_permissions enable row level security;

-- POLÍTICAS: schedules
-- 1. SELECT: Cada usuario puede consultar su horario propio O si tiene permiso explícito
create policy "schedules_select_own_or_permitted"
  on public.schedules
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.schedule_permissions sp
      where sp.owner_id = public.schedules.user_id
        and sp.viewer_id = auth.uid()
    )
  );

-- 2. INSERT: Cada usuario solo puede insertar su propio horario
create policy "schedules_insert_own_only"
  on public.schedules
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 3. UPDATE: Cada usuario solo puede modificar su propio horario
create policy "schedules_update_own_only"
  on public.schedules
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. DELETE: Cada usuario solo puede borrar su propio horario
create policy "schedules_delete_own_only"
  on public.schedules
  for delete
  to authenticated
  using (user_id = auth.uid());

-- POLÍTICAS: schedule_permissions
-- 1. SELECT: Visible para el otorgante (owner) o el receptor (viewer)
create policy "schedule_permissions_select"
  on public.schedule_permissions
  for select
  to authenticated
  using (owner_id = auth.uid() or viewer_id = auth.uid());

-- 2. INSERT: Solo el propietario del horario puede conceder permiso a otro
create policy "schedule_permissions_insert_owner"
  on public.schedule_permissions
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- 3. DELETE: El propietario puede revocar el permiso, o el viewer renunciar a él
create policy "schedule_permissions_delete_owner_or_viewer"
  on public.schedule_permissions
  for delete
  to authenticated
  using (owner_id = auth.uid() or viewer_id = auth.uid());

-- =========================================================================
-- SECCIÓN 3: FUNCIÓN RPC get_free_days_matches (Zero-Knowledge Coincidencias)
-- =========================================================================
-- Cruza los días libres del llamador con sus compañeros sin exponer turnos de trabajo
create or replace function public.get_free_days_matches(
  p_group_id uuid default null,
  p_start_date date default current_date,
  p_end_date date default (current_date + interval '60 days')::date,
  p_target_user_ids uuid[] default null
)
returns table (
  match_date date,
  matched_user_id uuid,
  matched_user_name text,
  group_id uuid,
  group_name text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  -- 1. Validar autenticación
  if v_caller_id is null then
    raise exception 'Acceso no autorizado: Debe haber una sesión activa de usuario.';
  end if;

  -- 2. Validar pertenencia al grupo si se especifica p_group_id
  if p_group_id is not null and not public.is_group_member(p_group_id, v_caller_id) then
    raise exception 'Acceso denegado: No perteneces al grupo especificado.';
  end if;

  return query
  with caller_free_days as (
    -- Días libres del llamador
    select s.date
    from public.schedules s
    where s.user_id = v_caller_id
      and s.is_free = true
      and (p_start_date is null or s.date >= p_start_date)
      and (p_end_date is null or s.date <= p_end_date)
  ),
  eligible_peers as (
    -- Contactos elegibles: Compañeros de grupos en común
    select distinct gm_peer.user_id as peer_id, g.id as grp_id, g.name as grp_name
    from public.group_members gm_caller
    join public.groups g on g.id = gm_caller.group_id
    join public.group_members gm_peer on gm_peer.group_id = g.id
    where gm_caller.user_id = v_caller_id
      and gm_peer.user_id <> v_caller_id
      and (p_group_id is null or g.id = p_group_id)
      and (p_target_user_ids is null or gm_peer.user_id = any(p_target_user_ids))
  )
  select 
    peer_schedules.date as match_date,
    peers.peer_id as matched_user_id,
    coalesce(p.nombre, p.email, 'Compañero') as matched_user_name,
    peers.grp_id as group_id,
    peers.grp_name as group_name
  from caller_free_days cfd
  join public.schedules peer_schedules 
    on peer_schedules.date = cfd.date
    and peer_schedules.is_free = true
  join eligible_peers peers 
    on peers.peer_id = peer_schedules.user_id
  left join public.perfiles p 
    on p.user_id = peers.peer_id
  order by match_date asc, matched_user_name asc;
end;
$$;

-- Versión agregada: Devuelve los días con el listado de personas que coinciden
create or replace function public.get_free_days_summary(
  p_group_id uuid default null,
  p_start_date date default current_date,
  p_end_date date default (current_date + interval '60 days')::date
)
returns table (
  match_date date,
  total_matches bigint,
  matched_user_ids uuid[],
  matched_user_names text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select 
    m.match_date,
    count(distinct m.matched_user_id) as total_matches,
    array_agg(distinct m.matched_user_id) as matched_user_ids,
    array_agg(distinct m.matched_user_name) as matched_user_names
  from public.get_free_days_matches(p_group_id, p_start_date, p_end_date) m
  group by m.match_date
  order by m.match_date asc;
end;
$$;

-- =========================================================================
-- SECCIÓN 4: TABLAS AUXILIARES EXISTENTES (Perfiles, Mensajes, Votaciones, Push)
-- =========================================================================

create table if not exists public.perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  nombre text not null unique,
  email text,
  pin text,
  rol text not null default 'usuario',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.mensajes (
  id bigint generated by default as identity primary key,
  usuario text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  texto text not null,
  group_id uuid references public.groups(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.votaciones (
  id bigint generated by default as identity primary key,
  opcion text not null,
  votantes text default '[]',
  group_id uuid references public.groups(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  usuario text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- RLS en tablas auxiliares
alter table public.perfiles enable row level security;
alter table public.mensajes enable row level security;
alter table public.votaciones enable row level security;
alter table public.suscripciones_push enable row level security;

-- Perfiles
create policy "perfiles_select" on public.perfiles for select using (true);
create policy "perfiles_update" on public.perfiles for update using (auth.uid() = user_id);

-- Mensajes vinculados al grupo
create policy "mensajes_select" on public.mensajes for select using (
  group_id is null or public.is_group_member(group_id, auth.uid())
);
create policy "mensajes_insert" on public.mensajes for insert with check (
  group_id is null or public.is_group_member(group_id, auth.uid())
);

-- Trigger de nuevo usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (user_id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'usuario')
  )
  on conflict (user_id) do update set
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
