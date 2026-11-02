-- =========================================================================
-- ESQUEMA PROFESIONAL KEDADAS: JERARQUÍA DE ROLES, RLS Y SISTEMA DE INVITACIONES
-- Compatible con Supabase PostgreSQL 15+ y Supabase Auth
-- =========================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- =========================================================================
-- SECCIÓN 1: ROLES Y SUPERADMINISTRADOR GLOBAL (Cule)
-- =========================================================================

-- Tabla de perfiles con soporte para rol de superadmin
create table if not exists public.perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  nombre text not null unique,
  email text,
  pin text,
  rol text not null default 'usuario', -- 'superadmin', 'admin', 'usuario'
  is_superadmin boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Asegurar columna is_superadmin si la tabla ya existía
alter table public.perfiles add column if not exists is_superadmin boolean not null default false;

-- DESIGNAR A "Cule" COMO ÚNICO SUPERADMINISTRADOR GLOBAL
update public.perfiles
set is_superadmin = true, rol = 'superadmin'
where lower(nombre) = 'cule' or lower(email) = 'maculecale@gmail.com';

-- Función SECURITY DEFINER para verificar si el llamador es Superadministrador
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and (p.is_superadmin = true or lower(p.nombre) = 'cule' or lower(p.email) = 'maculecale@gmail.com')
  );
$$;

-- Trigger: Asignar superadmin automáticamente si el email o nombre coincide con Cule
create or replace function public.handle_new_user_roles()
returns trigger as $$
declare
  v_nombre text;
  v_email text;
  v_es_superadmin boolean := false;
begin
  v_email := lower(coalesce(new.email, ''));
  v_nombre := lower(coalesce(new.raw_user_meta_data->>'nombre', split_part(v_email, '@', 1)));

  if v_nombre = 'cule' or v_email = 'maculecale@gmail.com' then
    v_es_superadmin := true;
  end if;

  insert into public.perfiles (user_id, email, nombre, rol, is_superadmin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when v_es_superadmin then 'superadmin' else 'usuario' end,
    v_es_superadmin
  )
  on conflict (user_id) do update set
    email = excluded.email,
    is_superadmin = excluded.is_superadmin or public.perfiles.is_superadmin,
    rol = case when excluded.is_superadmin or public.perfiles.is_superadmin then 'superadmin' else public.perfiles.rol end;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_roles();

-- =========================================================================
-- SECCIÓN 2: GESTIÓN DE GRUPOS Y MEMBRESÍAS
-- =========================================================================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icono text default '👥',
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_group_user unique (group_id, user_id)
);

create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_members_group on public.group_members(group_id);

-- Funciones auxiliares SECURITY DEFINER para evitar recursión en RLS
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

-- Trigger: El creador del grupo se convierte automáticamente en group_admin
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
-- SECCIÓN 3: SISTEMA DE INVITACIONES CON CÓDIGO ÚNICO (KED-XXXX)
-- =========================================================================

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique, -- Ej: KED-A7X9
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz default (now() + interval '30 days'),
  max_uses integer default null, -- null = usos ilimitados
  uses_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_invitations_code on public.group_invitations(code);
create index if not exists idx_invitations_group on public.group_invitations(group_id);

-- Función RPC para generar un código único de invitación (Solo Admin del grupo o Superadmin)
create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_custom_code text default null,
  p_max_uses integer default null,
  p_days_valid integer default 30
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
  v_code text;
  v_invitation public.group_invitations%rowtype;
begin
  -- 1. Verificar autorización: Superadmin o Admin de este grupo
  if not (public.is_superadmin() or public.is_group_admin(p_group_id, v_caller_id)) then
    raise exception 'Acceso denegado: Solo el administrador del grupo puede generar invitaciones.';
  end if;

  -- 2. Si se proporciona código personalizado, sanitizarlo; si no, generar uno aleatorio
  if p_custom_code is not null and length(trim(p_custom_code)) >= 4 then
    v_code := upper(trim(p_custom_code));
  else
    v_code := 'KED-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  end if;

  -- 3. Insertar o actualizar código activo
  insert into public.group_invitations (
    group_id,
    code,
    created_by,
    expires_at,
    max_uses,
    is_active
  )
  values (
    p_group_id,
    v_code,
    v_caller_id,
    now() + (p_days_valid || ' days')::interval,
    p_max_uses,
    true
  )
  on conflict (code) do update set
    expires_at = excluded.expires_at,
    is_active = true
  returning * into v_invitation;

  return json_build_object(
    'success', true,
    'code', v_invitation.code,
    'group_id', v_invitation.group_id,
    'expires_at', v_invitation.expires_at
  );
end;
$$;

-- Función RPC para unirse a un grupo mediante código de invitación
create or replace function public.join_group_with_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
  v_invitation record;
  v_group record;
  v_clean_code text;
begin
  -- 1. Validar autenticación
  if v_caller_id is null then
    raise exception 'Debes iniciar sesión para unirte a un grupo.';
  end if;

  v_clean_code := upper(trim(p_code));

  -- 2. Buscar invitación activa y válida
  select gi.*, g.name as group_name, g.icono as group_icono
  into v_invitation
  from public.group_invitations gi
  join public.groups g on g.id = gi.group_id
  where gi.code = v_clean_code
    and gi.is_active = true
    and (gi.expires_at is null or gi.expires_at > now())
    and (gi.max_uses is null or gi.uses_count < gi.max_uses);

  if v_invitation is null then
    raise exception 'Código de invitación inválido o caducado.';
  end if;

  -- 3. Comprobar si ya es miembro
  if public.is_group_member(v_invitation.group_id, v_caller_id) then
    return json_build_object(
      'success', true,
      'already_member', true,
      'message', 'Ya perteneces a este grupo.',
      'group_id', v_invitation.group_id,
      'group_name', v_invitation.group_name
    );
  end if;

  -- 4. Añadir a group_members
  insert into public.group_members (group_id, user_id, role)
  values (v_invitation.group_id, v_caller_id, 'member');

  -- 5. Incrementar contador de usos
  update public.group_invitations
  set uses_count = uses_count + 1
  where id = v_invitation.id;

  return json_build_object(
    'success', true,
    'already_member', false,
    'message', '¡Te has unido con éxito al grupo!',
    'group_id', v_invitation.group_id,
    'group_name', v_invitation.group_name,
    'role', 'member'
  );
end;
$$;

-- =========================================================================
-- SECCIÓN 4: HORARIOS Y COINCIDENCIAS SEGURAS (Zero-Knowledge)
-- =========================================================================

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  shift_type text not null, -- 'M', 'T', 'N', 'L', 'V'
  is_free boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_user_date unique (user_id, date)
);

create index if not exists idx_schedules_user_date on public.schedules(user_id, date);
create index if not exists idx_schedules_free_date on public.schedules(date) where is_free = true;

-- Tabla histórica "Turnos" (mantenida para retrocompatibilidad total)
create table if not exists public."Turnos" (
  id bigint generated by default as identity primary key,
  dia integer not null,
  usuario text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  indiceEstado integer not null default 0,
  mes_anio text not null,
  grupo text default 'Amigos',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_usuario_dia_mes unique (usuario, dia, mes_anio)
);

-- RPC: Coincidencias de días libres del grupo (ZERO-KNOWLEDGE)
-- Cruza únicamente días libres sin exponer horarios laborales ajenos
create or replace function public.get_group_free_matches(
  p_group_id uuid,
  p_start_date date default current_date,
  p_end_date date default (current_date + interval '60 days')::date
)
returns table (
  match_date date,
  total_free_members bigint,
  free_member_names text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  -- Solo miembros del grupo o el Superadmin pueden consultar coincidencias
  if not (public.is_superadmin() or public.is_group_member(p_group_id, v_caller_id)) then
    raise exception 'Acceso denegado: No perteneces a este grupo.';
  end if;

  return query
  with group_users as (
    select gm.user_id, coalesce(p.nombre, split_part(p.email, '@', 1), 'Compañero') as user_name
    from public.group_members gm
    join public.perfiles p on p.user_id = gm.user_id
    where gm.group_id = p_group_id
  ),
  free_days as (
    -- Días libres procedentes de schedules
    select s.date, gu.user_name
    from public.schedules s
    join group_users gu on gu.user_id = s.user_id
    where s.is_free = true
      and s.date >= p_start_date
      and s.date <= p_end_date

    union

    -- O días libres procedentes de "Turnos" (indiceEstado = 1)
    select 
      make_date(split_part(t.mes_anio, '-', 1)::int, split_part(t.mes_anio, '-', 2)::int + 1, t.dia) as date,
      gu.user_name
    from public."Turnos" t
    join group_users gu on (gu.user_id = t.usuario_id or lower(gu.user_name) = lower(t.usuario))
    where t.indiceEstado = 1
  )
  select 
    fd.date as match_date,
    count(distinct fd.user_name) as total_free_members,
    array_agg(distinct fd.user_name) as free_member_names
  from free_days fd
  where fd.date >= p_start_date and fd.date <= p_end_date
  group by fd.date
  having count(distinct fd.user_name) >= 2 -- Al menos 2 personas libres para coincidir
  order by match_date asc;
end;
$$;

-- =========================================================================
-- SECCIÓN 5: TABLAS DE ACTIVIDAD DE GRUPO (Mensajes y Votaciones)
-- =========================================================================

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

-- =========================================================================
-- SECCIÓN 6: ROW LEVEL SECURITY (RLS) ESTRICTO CON PODER TOTAL PARA CULE
-- =========================================================================

-- Forzar RLS en todas las tablas sensibles
alter table public.perfiles enable row level security;
alter table public.perfiles force row level security;

alter table public.groups enable row level security;
alter table public.groups force row level security;

alter table public.group_members enable row level security;
alter table public.group_members force row level security;

alter table public.group_invitations enable row level security;
alter table public.group_invitations force row level security;

alter table public.schedules enable row level security;
alter table public.schedules force row level security;

alter table public."Turnos" enable row level security;
alter table public."Turnos" force row level security;

alter table public.mensajes enable row level security;
alter table public.mensajes force row level security;

alter table public.votaciones enable row level security;
alter table public.votaciones force row level security;

-- Limpieza de políticas anteriores
drop policy if exists "perfiles_all" on public.perfiles;
drop policy if exists "groups_all" on public.groups;
drop policy if exists "group_members_all" on public.group_members;
drop policy if exists "turnos_select_strict" on public."Turnos";
drop policy if exists "turnos_insert_own" on public."Turnos";
drop policy if exists "turnos_update_own" on public."Turnos";
drop policy if exists "turnos_delete_own" on public."Turnos";
drop policy if exists "schedules_select_strict" on public.schedules;
drop policy if exists "schedules_insert_own_only" on public.schedules;
drop policy if exists "schedules_update_own_only" on public.schedules;
drop policy if exists "schedules_delete_own_only" on public.schedules;

-- -------------------------------------------------------------------------
-- POLÍTICAS: perfiles
-- -------------------------------------------------------------------------
create policy "perfiles_select"
  on public.perfiles for select to authenticated
  using (true); -- Los perfiles básicos son legibles para saber nombres y amigos

create policy "perfiles_update"
  on public.perfiles for update to authenticated
  using (public.is_superadmin() or auth.uid() = user_id)
  with check (public.is_superadmin() or auth.uid() = user_id);

create policy "perfiles_delete"
  on public.perfiles for delete to authenticated
  using (public.is_superadmin());

-- -------------------------------------------------------------------------
-- POLÍTICAS: groups
-- Cule (Superadmin) lo ve y controla todo. Usuarios normales solo sus grupos.
-- -------------------------------------------------------------------------
create policy "groups_select"
  on public.groups for select to authenticated
  using (public.is_superadmin() or public.is_group_member(id, auth.uid()));

create policy "groups_insert"
  on public.groups for insert to authenticated
  with check (public.is_superadmin() or created_by = auth.uid());

create policy "groups_update"
  on public.groups for update to authenticated
  using (public.is_superadmin() or public.is_group_admin(id, auth.uid()))
  with check (public.is_superadmin() or public.is_group_admin(id, auth.uid()));

create policy "groups_delete"
  on public.groups for delete to authenticated
  using (public.is_superadmin() or public.is_group_admin(id, auth.uid()));

-- -------------------------------------------------------------------------
-- POLÍTICAS: group_members
-- -------------------------------------------------------------------------
create policy "group_members_select"
  on public.group_members for select to authenticated
  using (public.is_superadmin() or public.is_group_member(group_id, auth.uid()));

create policy "group_members_insert"
  on public.group_members for insert to authenticated
  with check (
    public.is_superadmin()
    or public.is_group_admin(group_id, auth.uid())
    or user_id = auth.uid() -- Para unirse mediante código
  );

create policy "group_members_update"
  on public.group_members for update to authenticated
  using (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()))
  with check (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()));

create policy "group_members_delete"
  on public.group_members for delete to authenticated
  using (
    public.is_superadmin()
    or public.is_group_admin(group_id, auth.uid())
    or user_id = auth.uid()
  );

-- -------------------------------------------------------------------------
-- POLÍTICAS: group_invitations
-- -------------------------------------------------------------------------
create policy "group_invitations_select"
  on public.group_invitations for select to authenticated
  using (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()));

create policy "group_invitations_insert"
  on public.group_invitations for insert to authenticated
  with check (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()));

create policy "group_invitations_delete"
  on public.group_invitations for delete to authenticated
  using (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()));

-- -------------------------------------------------------------------------
-- POLÍTICAS: schedules (PRIVACIDAD ESTRICTA: SOLO PROPIO O SUPERADMIN)
-- -------------------------------------------------------------------------
create policy "schedules_select_strict"
  on public.schedules for select to authenticated
  using (public.is_superadmin() or user_id = auth.uid());

create policy "schedules_insert_own_only"
  on public.schedules for insert to authenticated
  with check (public.is_superadmin() or user_id = auth.uid());

create policy "schedules_update_own_only"
  on public.schedules for update to authenticated
  using (public.is_superadmin() or user_id = auth.uid())
  with check (public.is_superadmin() or user_id = auth.uid());

create policy "schedules_delete_own_only"
  on public.schedules for delete to authenticated
  using (public.is_superadmin() or user_id = auth.uid());

-- -------------------------------------------------------------------------
-- POLÍTICAS: "Turnos" (TABLA EN USO: SOLO PROPIO O SUPERADMIN)
-- -------------------------------------------------------------------------
create policy "turnos_select_strict"
  on public."Turnos" for select to authenticated
  using (
    public.is_superadmin()
    or usuario_id = auth.uid()
    or usuario = (select p.nombre from public.perfiles p where p.user_id = auth.uid())
  );

create policy "turnos_insert_own"
  on public."Turnos" for insert to authenticated
  with check (
    public.is_superadmin()
    or usuario_id = auth.uid()
    or usuario = (select p.nombre from public.perfiles p where p.user_id = auth.uid())
  );

create policy "turnos_update_own"
  on public."Turnos" for update to authenticated
  using (
    public.is_superadmin()
    or usuario_id = auth.uid()
    or usuario = (select p.nombre from public.perfiles p where p.user_id = auth.uid())
  );

create policy "turnos_delete_own"
  on public."Turnos" for delete to authenticated
  using (
    public.is_superadmin()
    or usuario_id = auth.uid()
    or usuario = (select p.nombre from public.perfiles p where p.user_id = auth.uid())
  );

-- -------------------------------------------------------------------------
-- POLÍTICAS: mensajes (CHAT DEL GRUPO)
-- -------------------------------------------------------------------------
create policy "mensajes_select"
  on public.mensajes for select to authenticated
  using (
    public.is_superadmin()
    or group_id is null
    or public.is_group_member(group_id, auth.uid())
  );

create policy "mensajes_insert"
  on public.mensajes for insert to authenticated
  with check (
    public.is_superadmin()
    or group_id is null
    or public.is_group_member(group_id, auth.uid())
  );

create policy "mensajes_delete"
  on public.mensajes for delete to authenticated
  using (
    public.is_superadmin()
    or (usuario_id is not null and usuario_id = auth.uid())
    or (group_id is not null and public.is_group_admin(group_id, auth.uid()))
  );

-- -------------------------------------------------------------------------
-- POLÍTICAS: votaciones (PLANES DEL GRUPO)
-- -------------------------------------------------------------------------
create policy "votaciones_select"
  on public.votaciones for select to authenticated
  using (
    public.is_superadmin()
    or group_id is null
    or public.is_group_member(group_id, auth.uid())
  );

create policy "votaciones_insert"
  on public.votaciones for insert to authenticated
  with check (
    public.is_superadmin()
    or group_id is null
    or public.is_group_member(group_id, auth.uid())
  );

create policy "votaciones_update"
  on public.votaciones for update to authenticated
  using (
    public.is_superadmin()
    or group_id is null
    or public.is_group_member(group_id, auth.uid())
  );

create policy "votaciones_delete"
  on public.votaciones for delete to authenticated
  using (
    public.is_superadmin()
    or (group_id is not null and public.is_group_admin(group_id, auth.uid()))
  );
