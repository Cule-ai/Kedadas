-- =========================================================================
-- MIGRACIÓN SQL: CREAR TABLA calendar_shares Y POLÍTICAS RLS EN SUPABASE
-- Ejecuta este script directamente en el "SQL Editor" de tu panel Supabase.
-- =========================================================================

-- 1. Habilitar extensiones necesarias para generar UUIDs
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
    select 1 where lower(coalesce(auth.jwt()->>'email', '')) = 'maculecale@gmail.com'
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

-- 4. Habilitar Row Level Security (RLS) en la tabla
alter table public.calendar_shares enable row level security;
alter table public.calendar_shares force row level security;

-- 5. Políticas de seguridad (RLS) para calendar_shares:
-- Permitir lectura (SELECT) tanto a usuarios autenticados como anónimos de la app
drop policy if exists "calendar_shares_select" on public.calendar_shares;
create policy "calendar_shares_select" on public.calendar_shares for select to anon, authenticated
  using (true);

-- Permitir conceder permisos (INSERT / UPSERT)
drop policy if exists "calendar_shares_insert" on public.calendar_shares;
create policy "calendar_shares_insert" on public.calendar_shares for insert to anon, authenticated
  with check (length(trim(owner_name)) > 0 and length(trim(granted_to)) > 0);

-- Permitir revocar permisos (DELETE)
drop policy if exists "calendar_shares_delete" on public.calendar_shares;
create policy "calendar_shares_delete" on public.calendar_shares for delete to anon, authenticated
  using (length(trim(owner_name)) > 0);

-- 6. Actualizar política de lectura en la tabla "Turnos" para permitir consultar turnos si hay permiso compartido
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'Turnos') then
    execute 'drop policy if exists "turnos_select_strict" on public."Turnos"';
    execute 'create policy "turnos_select_strict" on public."Turnos" for select to anon, authenticated
      using (
        public.is_superadmin()
        or usuario_id = auth.uid()
        or lower(usuario) = lower(coalesce(auth.jwt()->''user_metadata''->>''nombre'', split_part(auth.jwt()->>''email'', ''@'', 1)))
        or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid())
        or exists (
          select 1 from public.calendar_shares cs
          where lower(cs.owner_name) = lower(public."Turnos".usuario)
            and (
              lower(cs.granted_to) = lower(coalesce(auth.jwt()->''user_metadata''->>''nombre'', split_part(auth.jwt()->>''email'', ''@'', 1)))
              or cs.granted_to in (select p.nombre from public.perfiles p where p.user_id = auth.uid())
              or cs.granted_to_id = auth.uid()
            )
        )
      )';
  end if;
end $$;

-- 7. Asegurar que la columna password y ciudad_origen en perfiles estén al día
alter table public.perfiles add column if not exists password text default '1234';
alter table public.perfiles add column if not exists ciudad_origen text default 'Plasencia';
alter table public.perfiles alter column ciudad_origen set default 'Plasencia';
update public.perfiles set ciudad_origen = 'Plasencia' where lower(nombre) = 'cule' or ciudad_origen = 'Toledo' or ciudad_origen is null;
