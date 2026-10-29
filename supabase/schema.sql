-- =====================================================================
--  Reviews (boards) — esquema de base de datos y almacenamiento (Supabase)
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--  Es idempotente: se puede volver a ejecutar sin perder datos.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.submission_status as enum ('uploading', 'pending', 'approved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Boards: cada "sala" (Room Review, Costume Review, Pet Review…) con su propia URL
create table if not exists public.boards (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   constraint boards_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),  -- la regla completa, más abajo
  title            text not null check (char_length(title) between 1 and 80),
  description      text not null default '' check (char_length(description) <= 1000),
  is_active        boolean not null default true,   -- false: la página pública da 404
  submissions_open boolean not null default true,   -- false: la página se ve, el formulario no
  people_allowed   boolean not null default false,  -- true: pueden aparecer personas (p. ej. disfraces)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.submissions (
  id                uuid primary key,
  username          text not null check (char_length(username) between 1 and 40),
  email             text not null check (char_length(email) between 3 and 254),
  country           text not null check (char_length(country) between 2 and 60),
  description       text not null check (char_length(description) between 1 and 2000),
  status            public.submission_status not null default 'uploading',
  upload_token_hash text,               -- se borra al finalizar la subida
  media_count       smallint not null check (media_count between 1 and 5),
  created_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  reviewed_at       timestamptz
);

-- Privacidad (RGPD art. 7.1: poder demostrar el consentimiento) y derecho de supresión
alter table public.submissions add column if not exists consent_at timestamptz;
alter table public.submissions add column if not exists consent_version text;
alter table public.submissions add column if not exists deletion_token_hash text;
create unique index if not exists submissions_deletion_token_idx
  on public.submissions (deletion_token_hash) where deletion_token_hash is not null;

-- Cada board pertenece a un streamer (varios streamers pueden usar la misma web)
alter table public.boards add column if not exists streamer_name text not null default ''
  check (char_length(streamer_name) <= 40);
alter table public.boards add column if not exists platform text not null default 'twitch'
  check (platform in ('twitch', 'youtube', 'kick', 'tiktok', 'other'));

-- Contraseña de streamer de cada board:
--  · hash scrypt para comprobarla al iniciar sesión
--  · copia cifrada (AES-256-GCM, clave solo en el servidor) para que un admin pueda copiarla y compartirla
alter table public.boards add column if not exists streamer_password_hash text;
alter table public.boards add column if not exists streamer_password_enc text;

-- Cada entrega pertenece a un board. Migración de la versión con una sola sala: si quedan
-- entregas sin board, pasan a un board "Room Review". En una instalación nueva no hace nada.
alter table public.submissions add column if not exists board_id uuid references public.boards(id) on delete cascade;

do $$
declare v_board uuid;
begin
  if exists (select 1 from public.submissions where board_id is null) then
    insert into public.boards (slug, title, description)
    values ('room-review', 'Room Review',
            'Share up to 5 photos of your room for a chance to be reviewed on stream. Submissions stay private until approved.')
    on conflict (slug) do nothing;
    select id into v_board from public.boards where slug = 'room-review';
    update public.submissions set board_id = v_board where board_id is null;
  end if;
end $$;

alter table public.submissions alter column board_id set not null;

create index if not exists submissions_status_submitted_idx
  on public.submissions (status, submitted_at);
create index if not exists submissions_board_status_idx
  on public.submissions (board_id, status, submitted_at);

create table if not exists public.submission_media (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  storage_path  text not null unique,
  position      smallint not null check (position between 0 and 4),
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  unique (submission_id, position)
);

create index if not exists submission_media_submission_idx
  on public.submission_media (submission_id);

-- Limitador de peticiones (anti-spam y anti fuerza bruta)
create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null,
  window_start timestamptz not null
);

-- ---------------------------------------------------------------------
-- Seguridad: RLS activado y SIN políticas => las claves públicas
-- (anon / publishable) no pueden leer ni escribir NADA.
-- Todo el acceso pasa por el servidor de Next.js con la clave secreta.
-- ---------------------------------------------------------------------
alter table public.boards           enable row level security;
alter table public.submissions      enable row level security;
alter table public.submission_media enable row level security;
alter table public.rate_limits      enable row level security;

alter table public.boards           force row level security;
alter table public.submissions      force row level security;
alter table public.submission_media force row level security;
alter table public.rate_limits      force row level security;

revoke all on table public.boards           from anon, authenticated;
revoke all on table public.submissions      from anon, authenticated;
revoke all on table public.submission_media from anon, authenticated;
revoke all on table public.rate_limits      from anon, authenticated;

-- ---------------------------------------------------------------------
-- Funciones (transaccionales y atómicas)
-- ---------------------------------------------------------------------

-- Crea una entrega y sus fotos en UNA transacción: o se guarda todo o nada.
-- Comprueba en la misma transacción que el board está activo y abierto.
-- (borra las firmas de versiones anteriores, si existen)
drop function if exists public.create_submission(uuid, text, text, text, text, text, jsonb);
drop function if exists public.create_submission(uuid, text, text, text, text, text, jsonb, text, text);
create or replace function public.create_submission(
  p_id uuid,
  p_board_id uuid,
  p_username text,
  p_email text,
  p_country text,
  p_description text,
  p_token_hash text,
  p_media jsonb,            -- [{ "path": "...", "position": 0, "content_type": "image/jpeg" }, ...]
  p_consent_version text,
  p_deletion_hash text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int := jsonb_array_length(p_media);
  v_open boolean;
begin
  if v_count < 1 or v_count > 5 then
    raise exception 'invalid media count';
  end if;
  if p_consent_version is null or p_deletion_hash is null then
    raise exception 'consent required';
  end if;

  -- FOR SHARE: si un admin cierra el board a la vez, una de las dos operaciones espera a la otra
  select is_active and submissions_open into v_open from boards where id = p_board_id for share;
  if v_open is distinct from true then
    raise exception 'board closed' using errcode = 'P0001', hint = 'BOARD_CLOSED';
  end if;

  insert into submissions (id, board_id, username, email, country, description, upload_token_hash, media_count,
                           consent_at, consent_version, deletion_token_hash)
  values (p_id, p_board_id, p_username, p_email, p_country, p_description, p_token_hash, v_count,
          now(), p_consent_version, p_deletion_hash);

  insert into submission_media (submission_id, storage_path, position, content_type)
  select p_id, m->>'path', (m->>'position')::smallint, m->>'content_type'
  from jsonb_array_elements(p_media) as m;

  return p_id;
end $$;

-- Recuento de entregas por board para el panel de control
create or replace function public.board_stats()
returns table (board_id uuid, pending bigint, approved bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select board_id,
         count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'approved')
  from submissions
  group by board_id
$$;

-- Contador atómico por ventana de tiempo. Devuelve true si se permite.
-- El UPSERT bloquea la fila, así que dos peticiones simultáneas nunca
-- leen el mismo valor (no hay condición de carrera).
create or replace function public.rate_limit_hit(
  p_key text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.count + 1 end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start end
  returning count into v_count;

  return v_count <= p_limit;
end $$;

-- Pone a cero un contador (p. ej. tras un login correcto, para que solo cuenten los fallos)
create or replace function public.rate_limit_reset(p_key text) returns void
language sql
security invoker
set search_path = public
as $$ delete from rate_limits where key = p_key $$;

revoke all on function public.create_submission(uuid, uuid, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.board_stats() from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.rate_limit_reset(text) from public, anon, authenticated;
grant execute on function public.create_submission(uuid, uuid, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.board_stats() to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.rate_limit_reset(text) to service_role;

-- =====================================================================
--  Cuentas de administración, permisos por board y problemas reportados
-- =====================================================================

-- Direcciones reservadas para páginas de la web (debe coincidir con src/lib/slug.ts).
-- NOT VALID: no falla si un board antiguo ya usaba una de las nuevas; solo se aplica a cambios.
alter table public.boards drop constraint if exists boards_slug_check;
alter table public.boards add constraint boards_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48
         and slug not in ('login', 'privacy', 'delete', 'api', 'admin', 'admins', 'streamer', 'queue', 'deck',
                          'new', 'settings', 'static', 'public', 'assets', 'favicon', 'robots', 'sitemap',
                          'account', 'problems', 'report', 'contact', 'setup', 'logout', 'audit', 'activity'))
  not valid;

-- Cuentas (registro cerrado: solo un Site Admin crea cuentas)
create table if not exists public.admins (
  id                   uuid primary key default gen_random_uuid(),
  username             text not null unique
                       check (username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'),
  role                 text not null default 'admin' check (role in ('admin', 'site_admin')),
  password_hash        text not null,
  must_change_password boolean not null default true,  -- true mientras use la contraseña de un solo uso
  password_expires_at  timestamptz,                    -- caducidad de la contraseña de un solo uso
  session_version      integer not null default 1,     -- subirla cierra todas sus sesiones
  created_by           uuid references public.admins(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_login_at        timestamptz
);

-- Dueño de cada board y boards compartidos con otros admins
alter table public.boards add column if not exists owner_id uuid references public.admins(id) on delete set null;
create index if not exists boards_owner_idx on public.boards (owner_id);

create table if not exists public.board_members (
  board_id   uuid not null references public.boards(id) on delete cascade,
  admin_id   uuid not null references public.admins(id) on delete cascade,
  added_by   uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, admin_id)
);
create index if not exists board_members_admin_idx on public.board_members (admin_id);

-- Contraseña de Board Admin (moderación de la cola) y versiones de ambas contraseñas:
-- al regenerar una contraseña se sube su versión y las sesiones abiertas con la anterior dejan de valer.
alter table public.boards add column if not exists moderator_password_hash text;
alter table public.boards add column if not exists moderator_password_enc text;
alter table public.boards add column if not exists streamer_pw_version integer not null default 1;
alter table public.boards add column if not exists moderator_pw_version integer not null default 1;

-- Problemas reportados por cualquier visitante (los ven los Site Admins)
create table if not exists public.problem_reports (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid references public.boards(id) on delete set null,
  page          text not null default '' check (char_length(page) <= 200),
  category      text not null check (category in ('bug', 'privacy', 'content', 'access', 'other')),
  message       text not null check (char_length(message) between 10 and 2000),
  contact_email text check (contact_email is null or char_length(contact_email) between 3 and 254),
  locale        text not null default 'en' check (locale in ('en', 'es', 'pt', 'fr', 'ja')),
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.admins(id) on delete set null
);
create index if not exists problem_reports_status_idx on public.problem_reports (status, created_at desc);

alter table public.admins          enable row level security;
alter table public.board_members   enable row level security;
alter table public.problem_reports enable row level security;
alter table public.admins          force row level security;
alter table public.board_members   force row level security;
alter table public.problem_reports force row level security;
revoke all on table public.admins          from anon, authenticated;
revoke all on table public.board_members   from anon, authenticated;
revoke all on table public.problem_reports from anon, authenticated;

-- Configuración inicial: crea el PRIMER Site Admin solo si no existe ninguna cuenta.
-- El bloqueo de tabla impide que dos peticiones simultáneas creen dos.
-- Los boards sin dueño (de versiones anteriores) pasan a ser suyos.
create or replace function public.bootstrap_site_admin(p_username text, p_hash text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  lock table admins in share row exclusive mode;
  if exists (select 1 from admins) then
    raise exception 'already initialised' using hint = 'ALREADY_SETUP';
  end if;
  insert into admins (username, role, password_hash, must_change_password)
  values (p_username, 'site_admin', p_hash, false)
  returning id into v_id;
  update boards set owner_id = v_id where owner_id is null;
  return v_id;
end $$;

-- Cambiar el rol de un admin sin dejar nunca la web sin Site Admins.
-- FOR UPDATE sobre todos los Site Admins: dos cambios simultáneos se ejecutan uno detrás de otro.
create or replace function public.set_admin_role(p_target uuid, p_role text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_count int;
begin
  if p_role not in ('admin', 'site_admin') then raise exception 'invalid role'; end if;
  perform 1 from admins where role = 'site_admin' for update;
  if p_role = 'admin' then
    select count(*) into v_count from admins where role = 'site_admin' and id <> p_target;
    if v_count = 0 then raise exception 'last site admin' using hint = 'LAST_SITE_ADMIN'; end if;
  end if;
  update admins set role = p_role, session_version = session_version + 1, updated_at = now()
  where id = p_target;
  if not found then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
end $$;

-- Borrar un admin: sus boards pasan a quien lo borra, en la misma transacción.
create or replace function public.delete_admin(p_target uuid, p_actor uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_count int;
begin
  if p_target = p_actor then raise exception 'self' using hint = 'SELF'; end if;
  perform 1 from admins where role = 'site_admin' for update;
  select count(*) into v_count from admins where role = 'site_admin' and id <> p_target;
  if v_count = 0 then raise exception 'last site admin' using hint = 'LAST_SITE_ADMIN'; end if;
  update boards set owner_id = p_actor where owner_id = p_target;
  delete from admins where id = p_target;
  if not found then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
end $$;

-- Verificación en dos pasos (TOTP). El secreto se guarda cifrado (AES-256-GCM, clave derivada de SESSION_SECRET).
-- totp_last_step impide reutilizar el mismo código dos veces (ataques de repetición).
alter table public.admins add column if not exists totp_secret_enc text;
alter table public.admins add column if not exists totp_enabled_at timestamptz;
alter table public.admins add column if not exists totp_last_step bigint;

-- Cambiar la contraseña de una cuenta y cerrar todas sus sesiones en la misma operación.
-- p_clear_totp: al restablecer la contraseña (Site Admin) también se quita el 2FA, por si perdió el móvil.
create or replace function public.admin_set_password(
  p_id uuid, p_hash text, p_must_change boolean, p_expires timestamptz, p_clear_totp boolean
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v_sv int;
begin
  update admins set
    password_hash        = p_hash,
    must_change_password = p_must_change,
    password_expires_at  = p_expires,
    session_version      = session_version + 1,
    totp_secret_enc      = case when p_clear_totp then null else totp_secret_enc end,
    totp_enabled_at      = case when p_clear_totp then null else totp_enabled_at end,
    totp_last_step       = case when p_clear_totp then null else totp_last_step end,
    updated_at           = now()
  where id = p_id
  returning session_version into v_sv;
  if not found then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
  return v_sv;
end $$;

-- Activar (p_enc no nulo) o desactivar (nulo) el 2FA. También cierra las demás sesiones.
create or replace function public.admin_set_totp(p_id uuid, p_enc text, p_step bigint)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v_sv int;
begin
  update admins set
    totp_secret_enc = p_enc,
    totp_enabled_at = case when p_enc is null then null else now() end,
    totp_last_step  = p_step,
    session_version = session_version + 1,
    updated_at      = now()
  where id = p_id
  returning session_version into v_sv;
  if not found then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
  return v_sv;
end $$;

-- Gasta un paso TOTP: solo una petición puede usar cada código (y nunca uno anterior al último usado).
create or replace function public.admin_use_totp_step(p_id uuid, p_step bigint)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with u as (
    update admins set totp_last_step = p_step
    where id = p_id and totp_secret_enc is not null
      and (totp_last_step is null or totp_last_step < p_step)
    returning 1
  )
  select exists (select 1 from u);
$$;

-- Regenerar una contraseña de board: se cambia el hash y se sube la versión a la vez,
-- así cualquier sesión abierta con la contraseña anterior deja de valer al instante.
-- No toca updated_at: regenerar no debe invalidar un formulario de edición abierto.
create or replace function public.rotate_board_password(p_board uuid, p_kind text, p_hash text, p_enc text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v int;
begin
  if p_kind = 'streamer' then
    update boards set streamer_password_hash = p_hash, streamer_password_enc = p_enc,
                      streamer_pw_version = streamer_pw_version + 1
    where id = p_board returning streamer_pw_version into v;
  elsif p_kind = 'moderator' then
    update boards set moderator_password_hash = p_hash, moderator_password_enc = p_enc,
                      moderator_pw_version = moderator_pw_version + 1
    where id = p_board returning moderator_pw_version into v;
  else
    raise exception 'invalid kind';
  end if;
  if not found then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
  return v;
end $$;

revoke all on function public.admin_set_password(uuid, text, boolean, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.admin_set_totp(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_use_totp_step(uuid, bigint) from public, anon, authenticated;
revoke all on function public.rotate_board_password(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_password(uuid, text, boolean, timestamptz, boolean) to service_role;
grant execute on function public.admin_set_totp(uuid, text, bigint) to service_role;
grant execute on function public.admin_use_totp_step(uuid, bigint) to service_role;
grant execute on function public.rotate_board_password(uuid, text, text, text) to service_role;

revoke all on function public.bootstrap_site_admin(text, text) from public, anon, authenticated;
revoke all on function public.set_admin_role(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_site_admin(text, text) to service_role;
grant execute on function public.set_admin_role(uuid, text) to service_role;
grant execute on function public.delete_admin(uuid, uuid) to service_role;

-- =====================================================================
--  Registro de auditoría: quién hizo qué y cuándo (inicios de sesión, cuentas, boards, moderación)
-- =====================================================================
-- Sin claves foráneas a propósito: el registro se conserva aunque se borre la cuenta o el board
-- (por eso guarda una copia del nombre y del título). Nunca guarda datos de quien envía fotos
-- (ni email ni usuario): solo el id de la entrega.
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('account', 'moderator', 'streamer', 'visitor', 'system')),
  actor_id    uuid,
  actor_name  text not null default '' check (char_length(actor_name) <= 64),
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$' and char_length(action) <= 48),
  board_id    uuid,
  board_title text not null default '' check (char_length(board_title) <= 80),
  target_id   text check (char_length(target_id) <= 64),
  target_name text check (char_length(target_name) <= 64),
  details     jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 2048),
  ip_hash     text check (char_length(ip_hash) <= 64)
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc, id desc);
create index if not exists audit_log_board_idx   on public.audit_log (board_id, id desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_id, id desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on table public.audit_log from anon, authenticated;
-- El servidor solo puede leer, añadir y borrar (el borrado lo limita el trigger de abajo); nunca modificar
revoke update, truncate on table public.audit_log from service_role;
grant select, insert, delete on table public.audit_log to service_role;

-- Solo se puede AÑADIR. Ni siquiera la clave secreta puede modificar entradas ni borrar las que
-- tengan menos de 365 días (las más antiguas las borra el cron diario).
create or replace function public.audit_log_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit log entries cannot be modified';
  elsif tg_op = 'TRUNCATE' then
    raise exception 'audit log cannot be truncated';
  elsif tg_op = 'DELETE' and old.created_at > now() - interval '365 days' then
    raise exception 'audit log entries can only be deleted after 365 days';
  end if;
  return old;
end $$;

drop trigger if exists audit_log_guard_rows on public.audit_log;
create trigger audit_log_guard_rows before update or delete on public.audit_log
  for each row execute function public.audit_log_guard();
drop trigger if exists audit_log_guard_truncate on public.audit_log;
create trigger audit_log_guard_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_guard();

-- ---------------------------------------------------------------------
-- Almacenamiento: bucket PRIVADO con límites de tamaño y tipo
-- (Supabase rechaza en origen cualquier archivo que no cumpla).
-- No se crean políticas en storage.objects => el público no puede
-- listar, leer ni borrar. Solo se sube con URLs firmadas de un uso
-- que genera el servidor, y solo se ve con URLs firmadas temporales.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-media', 'room-media', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
