-- =========================================================================
-- KEDADAS · MIGRACIÓN DE SEGURIDAD (ejecutar UNA vez en el SQL Editor de Supabase)
-- Es idempotente: se puede repetir sin romper nada.
-- Haz antes una copia de seguridad (Database > Backups) por si acaso.
-- =========================================================================

-- 1. SUPERADMIN: solo por tabla perfiles o por email CONFIRMADO. Nunca por user_metadata.
create or replace function public.is_superadmin()
returns boolean language sql security definer set search_path = public, auth stable as $$
  select exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.is_superadmin = true or p.rol = 'superadmin')
  ) or exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'maculecale@gmail.com'
      and u.email_confirmed_at is not null
  );
$$;

-- Marca tu perfil real como superadmin (una sola vez, por email)
update public.perfiles p
set is_superadmin = true, rol = 'superadmin'
from auth.users u
where p.user_id = u.id and lower(u.email) = 'maculecale@gmail.com';

-- 2. TRIGGER DE REGISTRO: enlaza solo por email; el nombre NUNCA da privilegios ni secuestra perfiles.
create or replace function public.handle_new_user_roles()
returns trigger as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_nombre text := coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(v_email, '@', 1));
  v_final text := v_nombre;
  v_n int := 1;
begin
  -- Perfil preexistente con ese email y sin dueño
  update public.perfiles set user_id = new.id
  where user_id is null and email is not null and lower(email) = v_email;
  if found then return new; end if;

  -- Nombre libre (si está cogido se añade un número)
  while exists (select 1 from public.perfiles where lower(nombre) = lower(v_final)) loop
    v_n := v_n + 1;
    v_final := v_nombre || v_n;
  end loop;

  insert into public.perfiles (user_id, email, nombre, rol, is_superadmin)
  values (new.id, new.email, v_final, 'usuario', false);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 3. PERFILES: sin PIN, sin emails visibles y sin que nadie se auto-promocione
drop policy if exists "perfiles_insert" on public.perfiles;
drop policy if exists "perfiles_update" on public.perfiles;
create policy "perfiles_update" on public.perfiles for update to authenticated
  using (public.is_superadmin() or user_id = auth.uid());

alter table public.perfiles drop column if exists pin;

revoke all on public.perfiles from anon;
revoke insert, update, delete, select on public.perfiles from authenticated;
grant select (id, user_id, nombre, rol, is_superadmin, created_at) on public.perfiles to authenticated;
grant update (nombre) on public.perfiles to authenticated;

-- 4. GRUPOS: nadie se mete solo en un grupo (se entra por código de invitación, que usa RPC)
drop policy if exists "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members for insert to authenticated
  with check (public.is_superadmin() or public.is_group_admin(group_id, auth.uid()));

-- 5. TURNOS: propiedad solo por usuario_id / perfil (se elimina la comparación con user_metadata, falsificable)
alter table public."Turnos" alter column usuario_id set default auth.uid();

do $$
declare cmd text;
begin
  foreach cmd in array array['select','insert','update','delete'] loop
    execute format('drop policy if exists %I on public."Turnos"', 'turnos_' || cmd || case when cmd='select' then '_strict' else '_own' end);
  end loop;
end $$;

create policy "turnos_select_strict" on public."Turnos" for select to authenticated using (
  public.is_superadmin() or usuario_id = auth.uid()
  or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid()));
create policy "turnos_insert_own" on public."Turnos" for insert to authenticated with check (
  public.is_superadmin() or usuario_id = auth.uid()
  or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid()));
create policy "turnos_update_own" on public."Turnos" for update to authenticated using (
  public.is_superadmin() or usuario_id = auth.uid()
  or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid()));
create policy "turnos_delete_own" on public."Turnos" for delete to authenticated using (
  public.is_superadmin() or usuario_id = auth.uid()
  or usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid()));

-- El horario es de la persona, no del grupo. (Descomenta cuando el nuevo app.js esté desplegado.)
-- alter table public."Turnos" drop column if exists grupo;

-- 6. COINCIDENCIAS: devuelve SOLO días libres de las personas pedidas (nunca sus turnos de trabajo)
create or replace function public.get_free_matches(p_usuarios text[], p_mes_anio text)
returns table(dia integer, usuarios text[])
language sql security definer set search_path = public stable as $$
  select t.dia, array_agg(distinct t.usuario) as usuarios
  from public."Turnos" t
  where auth.uid() is not null
    and t.mes_anio = p_mes_anio
    and t.usuario = any(p_usuarios)
    -- tolera la columna con o sin mayúsculas (indiceEstado / indiceestado)
    and coalesce(to_jsonb(t)->>'indiceEstado', to_jsonb(t)->>'indiceestado') = '1'
  group by t.dia
  order by t.dia;
$$;
revoke all on function public.get_free_matches(text[], text) from public, anon;
grant execute on function public.get_free_matches(text[], text) to authenticated;

-- 7. MENSAJES Y VOTACIONES: añadir lo que faltaba (borrar mensajes propios, votar)
alter table public.mensajes alter column usuario_id set default auth.uid();

drop policy if exists "mensajes_delete" on public.mensajes;
create policy "mensajes_delete" on public.mensajes for delete to authenticated
  using (public.is_superadmin() or usuario_id = auth.uid());

drop policy if exists "votaciones_update" on public.votaciones;
create policy "votaciones_update" on public.votaciones for update to authenticated
  using (public.is_superadmin() or group_id is null or public.is_group_member(group_id, auth.uid()));

drop policy if exists "votaciones_delete" on public.votaciones;
create policy "votaciones_delete" on public.votaciones for delete to authenticated
  using (public.is_superadmin() or group_id is null or public.is_group_admin(group_id, auth.uid()));

-- 8. NOTIFICACIONES PUSH
create table if not exists public.push_subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro anti-spam: cada pareja y día solo se avisa una vez (lo usa solo el servidor)
create table if not exists public.push_avisados (
  user_a uuid not null, user_b uuid not null, mes_anio text not null, dia int not null,
  primary key (user_a, user_b, mes_anio, dia)
);
alter table public.push_avisados enable row level security;  -- sin políticas: solo service_role

-- =========================================================================
-- 9. GRUPOS REALES (groups / group_members) · aislamiento de chat, votaciones y coincidencias
-- =========================================================================
alter table public.groups alter column created_by set default auth.uid();

-- 9.1 Migrar los grupos antiguos (tabla "grupos") a groups + group_members.
--     Se enlazan personas por nombre de perfil; quien no tenga cuenta con email se omite.
do $$
declare r record; v_creator uuid; v_gid uuid; m jsonb; n text;
begin
  if to_regclass('public.grupos') is null then return; end if;
  for r in select to_jsonb(g) as j from public.grupos g loop
    select user_id into v_creator from public.perfiles
      where lower(nombre) = lower(r.j->>'creador') and user_id is not null limit 1;
    if v_creator is null then continue; end if;

    select id into v_gid from public.groups
      where lower(name) = lower(r.j->>'nombre') and created_by = v_creator limit 1;
    if v_gid is null then
      insert into public.groups (name, icono, description, created_by)
      values (r.j->>'nombre', coalesce(r.j->>'icono', '👥'), r.j->>'descripcion', v_creator)
      returning id into v_gid;       -- el trigger añade al creador como admin
    end if;

    m := r.j->'miembros';
    if jsonb_typeof(m) = 'string' then
      begin m := (m #>> '{}')::jsonb; exception when others then m := '[]'::jsonb; end;
    end if;
    if m is null or jsonb_typeof(m) <> 'array' then m := '[]'::jsonb; end if;

    for n in select jsonb_array_elements_text(m) loop
      insert into public.group_members (group_id, user_id, role)
      select v_gid, p.user_id, 'member' from public.perfiles p
      where lower(p.nombre) = lower(n) and p.user_id is not null
      on conflict (group_id, user_id) do nothing;
    end loop;
  end loop;
end $$;

-- 9.2 Asignar mensajes y votaciones antiguos a su grupo (por nombre)
alter table public.mensajes   add column if not exists grupo text;
alter table public.votaciones add column if not exists grupo text;
update public.mensajes m   set group_id = g.id from public.groups g
  where m.group_id is null and m.grupo is not null and lower(g.name) = lower(m.grupo);
update public.votaciones v set group_id = g.id from public.groups g
  where v.group_id is null and v.grupo is not null and lower(g.name) = lower(v.grupo);

-- 9.3 Políticas estrictas: sin group_id o sin ser miembro, no se ve nada
drop policy if exists "mensajes_select" on public.mensajes;
drop policy if exists "mensajes_insert" on public.mensajes;
drop policy if exists "mensajes_delete" on public.mensajes;
create policy "mensajes_select" on public.mensajes for select to authenticated
  using (public.is_superadmin() or (group_id is not null and public.is_group_member(group_id, auth.uid())));
create policy "mensajes_insert" on public.mensajes for insert to authenticated
  with check (group_id is not null and public.is_group_member(group_id, auth.uid()) and usuario_id = auth.uid());
create policy "mensajes_delete" on public.mensajes for delete to authenticated
  using (public.is_superadmin() or usuario_id = auth.uid()
         or (group_id is not null and public.is_group_admin(group_id, auth.uid())));

drop policy if exists "votaciones_select" on public.votaciones;
drop policy if exists "votaciones_insert" on public.votaciones;
drop policy if exists "votaciones_update" on public.votaciones;
drop policy if exists "votaciones_delete" on public.votaciones;
create policy "votaciones_select" on public.votaciones for select to authenticated
  using (public.is_superadmin() or (group_id is not null and public.is_group_member(group_id, auth.uid())));
create policy "votaciones_insert" on public.votaciones for insert to authenticated
  with check (group_id is not null and public.is_group_member(group_id, auth.uid()));
create policy "votaciones_update" on public.votaciones for update to authenticated
  using (public.is_superadmin() or (group_id is not null and public.is_group_member(group_id, auth.uid())));
create policy "votaciones_delete" on public.votaciones for delete to authenticated
  using (public.is_superadmin() or (group_id is not null and public.is_group_admin(group_id, auth.uid())));

-- 9.4 Coincidencias: solo con personas con las que compartes grupo (o contigo mismo)
create or replace function public.get_free_matches(p_usuarios text[], p_mes_anio text)
returns table(dia integer, usuarios text[])
language sql security definer set search_path = public stable as $$
  select t.dia, array_agg(distinct t.usuario) as usuarios
  from public."Turnos" t
  where auth.uid() is not null
    and t.mes_anio = p_mes_anio
    and t.usuario = any(p_usuarios)
    and coalesce(to_jsonb(t)->>'indiceEstado', to_jsonb(t)->>'indiceestado') = '1'
    and (
      public.is_superadmin()
      or t.usuario in (select p.nombre from public.perfiles p where p.user_id = auth.uid())
      or t.usuario in (
        select p.nombre from public.perfiles p
        join public.group_members b on b.user_id = p.user_id
        join public.group_members a on a.group_id = b.group_id
        where a.user_id = auth.uid())
    )
  group by t.dia
  order by t.dia;
$$;
revoke all on function public.get_free_matches(text[], text) from public, anon;
grant execute on function public.get_free_matches(text[], text) to authenticated;

-- 9.5 Invitaciones: un código ya existente no se puede reactivar ni reutilizar desde otro grupo
create or replace function public.create_group_invitation(
  p_group_id uuid, p_custom_code text default null, p_max_uses integer default null, p_days_valid integer default 30)
returns json language plpgsql security definer set search_path = public, auth as $$
declare
  v_caller uuid := auth.uid();
  v_code text;
  v_inv public.group_invitations%rowtype;
begin
  if not (public.is_superadmin() or public.is_group_admin(p_group_id, v_caller)) then
    raise exception 'Acceso denegado: Solo el administrador del grupo puede generar invitaciones.';
  end if;

  if p_custom_code is not null and length(trim(p_custom_code)) >= 4 then
    v_code := upper(trim(p_custom_code));
    if exists (select 1 from public.group_invitations where code = v_code) then
      raise exception 'Ese código ya existe. Elige otro.';
    end if;
  else
    loop
      v_code := 'KED-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.group_invitations where code = v_code);
    end loop;
  end if;

  insert into public.group_invitations (group_id, code, created_by, expires_at, max_uses, is_active)
  values (p_group_id, v_code, v_caller, now() + (p_days_valid || ' days')::interval, p_max_uses, true)
  returning * into v_inv;

  return json_build_object('success', true, 'code', v_inv.code, 'group_id', v_inv.group_id, 'expires_at', v_inv.expires_at);
end;
$$;

-- 9.6 Unirse con código: bloqueo de fila para que max_uses no se supere con usos simultáneos
create or replace function public.join_group_with_code(p_code text)
returns json language plpgsql security definer set search_path = public, auth as $$
declare
  v_caller uuid := auth.uid();
  v_inv record;
begin
  if v_caller is null then raise exception 'Debes iniciar sesión para unirte a un grupo.'; end if;

  select gi.id, gi.group_id, g.name as group_name into v_inv
  from public.group_invitations gi join public.groups g on g.id = gi.group_id
  where gi.code = upper(trim(p_code)) and gi.is_active = true
    and (gi.expires_at is null or gi.expires_at > now())
    and (gi.max_uses is null or gi.uses_count < gi.max_uses)
  for update of gi;

  if v_inv.id is null then raise exception 'Código de invitación inválido o caducado.'; end if;

  if public.is_group_member(v_inv.group_id, v_caller) then
    return json_build_object('success', true, 'message', 'Ya perteneces a este grupo.', 'group_name', v_inv.group_name);
  end if;

  insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, v_caller, 'member');
  update public.group_invitations set uses_count = uses_count + 1 where id = v_inv.id;

  return json_build_object('success', true, 'message', '¡Te has unido con éxito!', 'group_name', v_inv.group_name);
end;
$$;

-- =========================================================================
-- 10. COMPROBACIÓN FINAL: avisa de políticas demasiado permisivas que hayan quedado
--     (las políticas se SUMAN: una sola con "using (true)" anula todas las demás).
-- =========================================================================
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('Turnos', 'mensajes', 'votaciones', 'group_members', 'groups', 'group_invitations', 'push_subscriptions')
      and (qual = 'true' or with_check = 'true')
  loop
    raise warning 'Política muy permisiva: %.% — revísala o elimínala', r.tablename, r.policyname;
  end loop;
end $$;

-- Para revisar a mano todas las políticas activas:
-- select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;

-- =========================================================================
-- 11. PASSKEYS (Face ID / Touch ID reales, verificadas en el servidor)
--     Solo accesible con la service_role (funciones /api); sin políticas = nadie más puede leerla.
-- =========================================================================
create table if not exists public.passkey_credentials (
  id text primary key,                          -- id de credencial (base64url)
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key_jwk jsonb not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkey_credentials_user_idx on public.passkey_credentials(user_id);
alter table public.passkey_credentials enable row level security;
revoke all on public.passkey_credentials from anon, authenticated;

-- =========================================================================
-- 12. PASSKEYS: retos de un solo uso y límite de intentos (solo service_role)
-- =========================================================================
create table if not exists public.passkey_retos_usados (
  hash text primary key,
  created_at timestamptz not null default now()
);
create table if not exists public.passkey_fallos (
  id bigint generated by default as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists passkey_fallos_ip_idx on public.passkey_fallos (ip, created_at);
alter table public.passkey_retos_usados enable row level security;
alter table public.passkey_fallos enable row level security;
revoke all on public.passkey_retos_usados, public.passkey_fallos from anon, authenticated;
