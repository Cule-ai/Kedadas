-- =========================================================================
-- MIGRACIÓN SQL ACTUALIZADA: COMPARTIR HORARIOS, GRUPOS Y ONBOARDING
-- Ejecuta este script directamente en el "SQL Editor" de tu panel Supabase.
-- =========================================================================

-- 1. Habilitar extensiones necesarias para generar UUIDs y cifrado
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 1.1 Asegurar existencia de la función auxiliar is_superadmin()
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 where lower(coalesce((auth.jwt()::jsonb ->> 'email'), '')) = 'maculecale@gmail.com'
    or exists (
      select 1 from public.perfiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_superadmin, false) = true
    )
  );
$$;

-- 2. Crear tabla public.calendar_shares si no existe
create table if not exists public.calendar_shares (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  granted_to text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  granted_to_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_owner_granted unique (owner_name, granted_to)
);

-- 3. Crear índices para optimizar las consultas por propietario y receptor
create index if not exists idx_calendar_shares_owner on public.calendar_shares(lower(owner_name));
create index if not exists idx_calendar_shares_granted on public.calendar_shares(lower(granted_to));

-- 4. Habilitar Row Level Security (RLS) en calendar_shares
alter table public.calendar_shares enable row level security;
alter table public.calendar_shares force row level security;

-- 5. Políticas de seguridad (RLS) para calendar_shares:
drop policy if exists "calendar_shares_select" on public.calendar_shares;
create policy "calendar_shares_select" on public.calendar_shares for select to anon, authenticated
  using (
    public.is_superadmin()
    or owner_id = auth.uid()
    or granted_to_id = auth.uid()
    or lower(owner_name) in (select lower(p.nombre) from public.perfiles p where p.user_id = auth.uid())
    or lower(granted_to) in (select lower(p.nombre) from public.perfiles p where p.user_id = auth.uid())
    or length(trim(owner_name)) > 0
  );

drop policy if exists "calendar_shares_insert" on public.calendar_shares;
create policy "calendar_shares_insert" on public.calendar_shares for insert to anon, authenticated
  with check (
    length(trim(owner_name)) > 0 
    and length(trim(granted_to)) > 0
    and lower(owner_name) <> lower(granted_to)
    and (
      public.is_superadmin()
      or owner_id = auth.uid()
      or lower(owner_name) in (select lower(p.nombre) from public.perfiles p where p.user_id = auth.uid())
      or auth.uid() is null
    )
  );

drop policy if exists "calendar_shares_delete" on public.calendar_shares;
create policy "calendar_shares_delete" on public.calendar_shares for delete to anon, authenticated
  using (
    public.is_superadmin()
    or owner_id = auth.uid()
    or granted_to_id = auth.uid()
    or lower(owner_name) in (select lower(p.nombre) from public.perfiles p where p.user_id = auth.uid())
    or lower(granted_to) in (select lower(p.nombre) from public.perfiles p where p.user_id = auth.uid())
    or auth.uid() is null
  );

-- 6. Actualizar política de lectura en la tabla "Turnos"
drop policy if exists "turnos_select_strict" on public."Turnos";
create policy "turnos_select_strict" on public."Turnos" for select to anon, authenticated
  using (
    public.is_superadmin()
    or usuario_id = auth.uid()
    or lower(usuario) = lower(coalesce(
      (auth.jwt()::jsonb -> 'user_metadata' ->> 'nombre'),
      split_part(coalesce((auth.jwt()::jsonb ->> 'email'), ''), '@', 1)
    ))
    or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid())
    or exists (
      select 1 from public.calendar_shares cs
      where lower(cs.owner_name) = lower(public."Turnos".usuario)
        and (
          lower(cs.granted_to) = lower(coalesce(
            (auth.jwt()::jsonb -> 'user_metadata' ->> 'nombre'),
            split_part(coalesce((auth.jwt()::jsonb ->> 'email'), ''), '@', 1)
          ))
          or cs.granted_to in (select p.nombre from public.perfiles p where p.user_id = auth.uid())
          or cs.granted_to_id = auth.uid()
        )
    )
    or auth.uid() is null
  );

-- 7. Asegurar columna pin_hash y ciudad_origen en perfiles
alter table public.perfiles add column if not exists pin_hash text default 'c8713d32bc75965c40cfea07ef93f9dd985f348954e81b3f39f768a0da544b53';
alter table public.perfiles add column if not exists ciudad_origen text default 'Plasencia';
alter table public.perfiles alter column ciudad_origen set default 'Plasencia';
update public.perfiles set ciudad_origen = 'Plasencia' where lower(nombre) = 'cule' or ciudad_origen = 'Toledo' or ciudad_origen is null;

-- Políticas de RLS en public.perfiles para registro y lectura
alter table public.perfiles enable row level security;
alter table public.perfiles force row level security;

drop policy if exists "perfiles_select_all" on public.perfiles;
create policy "perfiles_select_all" on public.perfiles for select to anon, authenticated
  using (true);

drop policy if exists "perfiles_insert_all" on public.perfiles;
create policy "perfiles_insert_all" on public.perfiles for insert to anon, authenticated
  with check (true);

drop policy if exists "perfiles_update_all" on public.perfiles;
create policy "perfiles_update_all" on public.perfiles for update to anon, authenticated
  using (true)
  with check (true);

-- 8. Asegurar tabla public.grupos para sincronizar grupos con miembros y códigos de acceso
create table if not exists public.grupos (
  id text primary key,
  nombre text not null,
  icono text default '👥',
  creador text default 'Cule',
  miembros jsonb default '["Cule"]'::jsonb,
  codigo_acceso text unique,
  descripcion text default '',
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.grupos enable row level security;
alter table public.grupos force row level security;

drop policy if exists "grupos_select_all" on public.grupos;
create policy "grupos_select_all" on public.grupos for select to anon, authenticated
  using (true);

drop policy if exists "grupos_insert_all" on public.grupos;
create policy "grupos_insert_all" on public.grupos for insert to anon, authenticated
  with check (true);

drop policy if exists "grupos_update_all" on public.grupos;
create policy "grupos_update_all" on public.grupos for update to anon, authenticated
  using (true)
  with check (true);
