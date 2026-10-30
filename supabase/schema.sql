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

-- Crea una entrega y sus archivos (fotos y, si el board lo permite, un vídeo) en UNA transacción:
-- o se guarda todo o nada. Comprueba en la misma transacción que el board está activo y abierto,
-- que su streamer está activo y que acepta vídeos si se envía alguno.
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
  v_count  int := jsonb_array_length(p_media);
  v_videos int;
  v_open   boolean;
  v_allow  boolean;
begin
  if v_count < 1 or v_count > 5 then
    raise exception 'invalid media count';
  end if;
  if p_consent_version is null or p_deletion_hash is null then
    raise exception 'consent required';
  end if;

  -- FOR SHARE: si un admin cierra el board (o suspenden al streamer) a la vez, una operación espera a la otra
  select b.is_active and b.submissions_open and coalesce(a.status = 'active', false), b.allow_videos
    into v_open, v_allow
  from boards b left join admins a on a.id = b.streamer_id
  where b.id = p_board_id
  for share of b;
  if v_open is distinct from true then
    raise exception 'board closed' using errcode = 'P0001', hint = 'BOARD_CLOSED';
  end if;

  select count(*) into v_videos from jsonb_array_elements(p_media) as m where m->>'content_type' like 'video/%';
  if v_videos > 0 and v_allow is distinct from true then
    raise exception 'videos not allowed' using hint = 'VIDEOS_OFF';
  end if;
  if v_videos > 1 then  -- debe coincidir con MAX_VIDEOS (src/lib/limits.ts)
    raise exception 'too many videos' using hint = 'VIDEOS_OFF';
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

-- Nombres reservados (debe coincidir con RESERVED_PATHS en src/lib/slug.ts).
-- NOT VALID: no falla si un board antiguo ya usaba una de las nuevas; solo se aplica a cambios.
alter table public.boards drop constraint if exists boards_slug_check;
alter table public.boards add constraint boards_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48
         and slug not in ('login', 'privacy', 'delete', 'api', 'admin', 'admins', 'streamer', 'streamers', 'queue', 'deck',
                          'new', 'settings', 'static', 'public', 'assets', 'favicon', 'robots', 'sitemap', 'panel', 'team',
                          'account', 'problems', 'report', 'contact', 'setup', 'logout', 'audit', 'activity', 'search', 'auth'))
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

-- Configuración inicial: crea el Owner (el primer Site Admin) solo si no existe ninguna cuenta.
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
  if exists (select 1 from admins where role <> 'streamer') then
    raise exception 'already initialised' using hint = 'ALREADY_SETUP';
  end if;
  insert into admins (username, role, password_hash, must_change_password)
  values (p_username, 'owner', p_hash, false)
  returning id into v_id;
  update boards set owner_id = v_id where owner_id is null;
  return v_id;
end $$;

-- Cambiar el rol de una cuenta del equipo entre Admin y Site Admin.
-- El Owner y los streamers no se pueden cambiar. FOR UPDATE: dos cambios simultáneos van uno detrás de otro.
-- Al pasar a Site Admin deja de ocupar plaza en los equipos de streamer (ya ve todos los boards).
create or replace function public.set_admin_role(p_target uuid, p_role text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_role text; v_count int;
begin
  if p_role not in ('admin', 'site_admin') then raise exception 'invalid role'; end if;
  perform 1 from admins where role in ('owner', 'site_admin') for update;
  select role into v_role from admins where id = p_target for update;
  if v_role is null then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
  if v_role not in ('admin', 'site_admin') then raise exception 'protected' using hint = 'PROTECTED'; end if;
  if p_role = 'admin' then
    select count(*) into v_count from admins where role in ('owner', 'site_admin') and id <> p_target;
    if v_count = 0 then raise exception 'last site admin' using hint = 'LAST_SITE_ADMIN'; end if;
  end if;
  update admins set role = p_role, session_version = session_version + 1, updated_at = now()
  where id = p_target;
  if p_role = 'site_admin' then
    delete from streamer_admins where admin_id = p_target;
  end if;
end $$;

-- Borrar una cuenta del equipo (Admin o Site Admin): sus boards pasan a quien la borra, en la misma transacción.
-- El Owner no se puede borrar; los streamers se gestionan aparte.
create or replace function public.delete_admin(p_target uuid, p_actor uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_role text;
begin
  if p_target = p_actor then raise exception 'self' using hint = 'SELF'; end if;
  select role into v_role from admins where id = p_target for update;
  if v_role is null then raise exception 'not found' using hint = 'NOT_FOUND'; end if;
  if v_role not in ('admin', 'site_admin') then raise exception 'protected' using hint = 'PROTECTED'; end if;
  update boards set owner_id = p_actor where owner_id = p_target;
  delete from admins where id = p_target;
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

-- =====================================================================
--  Owner, streamers (Twitch), equipos de streamer, desenfoque y vídeos
-- =====================================================================

-- Roles:
--  owner      → el primer Site Admin. Verificación en dos pasos obligatoria; no se puede borrar ni degradar.
--  site_admin → todo, incluidas las cuentas.
--  admin      → sus boards, los compartidos y los de los streamers a los que está asignado.
--  streamer   → entra con Twitch; crea sus boards y ve su deck (no la cola). Espera aprobación de un Site Admin.
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'site_admin', 'admin', 'streamer'));

alter table public.admins add column if not exists twitch_id    text;
alter table public.admins add column if not exists display_name text;
alter table public.admins add column if not exists avatar_url   text;
alter table public.admins add column if not exists status       text not null default 'active';
alter table public.admins add column if not exists approved_by  uuid references public.admins(id) on delete set null;
alter table public.admins add column if not exists approved_at  timestamptz;

alter table public.admins drop constraint if exists admins_status_check;
alter table public.admins add constraint admins_status_check check (status in ('active', 'pending', 'suspended'));
alter table public.admins drop constraint if exists admins_display_name_check;
alter table public.admins add constraint admins_display_name_check check (display_name is null or char_length(display_name) <= 64);
-- Solo imágenes de perfil del CDN de Twitch (la CSP solo permite ese origen)
alter table public.admins drop constraint if exists admins_avatar_url_check;
alter table public.admins add constraint admins_avatar_url_check
  check (avatar_url is null or (char_length(avatar_url) <= 300 and avatar_url like 'https://static-cdn.jtvnw.net/%'));
create unique index if not exists admins_twitch_id_idx on public.admins (twitch_id) where twitch_id is not null;

-- Los streamers no tienen contraseña; el resto de cuentas, sí. Solo los streamers tienen Twitch.
alter table public.admins alter column password_hash drop not null;
alter table public.admins drop constraint if exists admins_password_check;
alter table public.admins add constraint admins_password_check check (role = 'streamer' or password_hash is not null);
alter table public.admins drop constraint if exists admins_twitch_check;
alter table public.admins add constraint admins_twitch_check check ((role = 'streamer') = (twitch_id is not null));

-- Nombres: el equipo usa su nombre de usuario; los streamers, su login de Twitch (que es su URL).
-- Son espacios separados: un Admin y un streamer pueden llamarse igual.
alter table public.admins drop constraint if exists admins_username_check;
alter table public.admins add constraint admins_username_check check (
  (role <> 'streamer' and username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$')
  or (role = 'streamer' and username ~ '^[a-z0-9_]{1,40}$'));
alter table public.admins drop constraint if exists admins_username_key;
create unique index if not exists admins_staff_username_idx    on public.admins (username) where role <> 'streamer';
create unique index if not exists admins_streamer_username_idx on public.admins (username) where role = 'streamer';
-- Solo puede haber un Owner
create unique index if not exists admins_one_owner_idx on public.admins ((true)) where role = 'owner';

-- Instalaciones anteriores: el Site Admin más antiguo pasa a ser el Owner (tendrá que activar el 2FA al entrar)
do $$
begin
  if not exists (select 1 from public.admins where role = 'owner') then
    update public.admins set role = 'owner', session_version = session_version + 1, updated_at = now()
    where id = (select id from public.admins where role = 'site_admin' order by created_at, id limit 1);
  end if;
end $$;

-- Equipo de cada streamer: hasta 2 Admins (debe coincidir con MAX_TEAM en src/lib/limits.ts)
create table if not exists public.streamer_admins (
  streamer_id uuid not null references public.admins(id) on delete cascade,
  admin_id    uuid not null references public.admins(id) on delete cascade,
  added_by    uuid references public.admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (streamer_id, admin_id)
);
create index if not exists streamer_admins_admin_idx on public.streamer_admins (admin_id);
alter table public.streamer_admins enable row level security;
alter table public.streamer_admins force row level security;
revoke all on table public.streamer_admins from anon, authenticated;

-- Boards: cada uno pertenece a un streamer y su dirección es /{streamer}/{board}.
-- El mismo nombre de board puede repetirse en streamers distintos.
alter table public.boards add column if not exists streamer_id  uuid references public.admins(id) on delete set null;
alter table public.boards add column if not exists blur_new     boolean not null default true;   -- deck: cada review empieza difuminada
alter table public.boards add column if not exists allow_videos boolean not null default false;  -- se puede enviar un vídeo
create index if not exists boards_streamer_idx on public.boards (streamer_id);
alter table public.boards drop constraint if exists boards_slug_key;
create unique index if not exists boards_streamer_slug_idx on public.boards (streamer_id, slug);
-- (streamer_name y platform son de versiones anteriores: ya no se usan; el streamer sale de su cuenta de Twitch)

create or replace function public.boards_streamer_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.streamer_id is not null and not exists (select 1 from admins where id = new.streamer_id and role = 'streamer') then
    raise exception 'not a streamer' using hint = 'NOT_STREAMER';
  end if;
  return new;
end $$;
drop trigger if exists boards_streamer_guard on public.boards;
create trigger boards_streamer_guard before insert or update of streamer_id on public.boards
  for each row execute function public.boards_streamer_guard();

-- Archivos: fotos y vídeos (MP4/WebM, comprimidos en el navegador y sin audio)
alter table public.submission_media drop constraint if exists submission_media_content_type_check;
alter table public.submission_media add constraint submission_media_content_type_check
  check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'));

-- Entrada con Twitch: crea la cuenta (pendiente de aprobación) o actualiza su login, nombre e imagen.
-- Si otra cuenta tenía ese login (alguien que se cambió el nombre en Twitch), se le pone uno provisional.
-- p_max_pending: límite de solicitudes pendientes, para que nadie llene la tabla.
create or replace function public.streamer_sign_in(
  p_twitch_id text, p_login text, p_display text, p_avatar text, p_max_pending int
) returns table (o_id uuid, o_status text, o_session_version int, o_new boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare r admins%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('twitch:' || p_twitch_id));
  update admins set username = 'renamed_' || substr(md5(id::text), 1, 12), updated_at = now()
  where role = 'streamer' and username = p_login and twitch_id <> p_twitch_id;

  select * into r from admins where twitch_id = p_twitch_id for update;
  if found then
    update admins set username = p_login, display_name = p_display, avatar_url = p_avatar, updated_at = now(),
                      last_login_at = case when r.status = 'active' then now() else last_login_at end
    where id = r.id;
    return query select r.id, r.status, r.session_version, false;
  else
    if (select count(*) from admins where role = 'streamer' and status = 'pending') >= p_max_pending then
      raise exception 'too many pending' using hint = 'PENDING_FULL';
    end if;
    insert into admins (username, role, password_hash, must_change_password, twitch_id, display_name, avatar_url, status)
    values (p_login, 'streamer', null, false, p_twitch_id, p_display, p_avatar, 'pending')
    returning * into r;
    return query select r.id, r.status, r.session_version, true;
  end if;
end $$;

-- Añadir un Admin existente al equipo de un streamer (máximo 2).
-- FOR UPDATE sobre el streamer: dos peticiones simultáneas no pueden pasarse del límite.
create or replace function public.assign_streamer_admin(p_streamer uuid, p_admin uuid, p_actor uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from admins where id = p_streamer and role = 'streamer' and status = 'active' for update;
  if not found then raise exception 'not a streamer' using hint = 'NOT_STREAMER'; end if;
  if not exists (select 1 from admins where id = p_admin and role = 'admin') then
    raise exception 'not an admin' using hint = 'NOT_ADMIN';
  end if;
  if exists (select 1 from streamer_admins where streamer_id = p_streamer and admin_id = p_admin) then
    raise exception 'already' using hint = 'ALREADY';
  end if;
  if (select count(*) from streamer_admins where streamer_id = p_streamer) >= 2 then
    raise exception 'team full' using hint = 'TEAM_FULL';
  end if;
  insert into streamer_admins (streamer_id, admin_id, added_by) values (p_streamer, p_admin, p_actor);
end $$;

-- Un streamer crea un Admin nuevo para su equipo: la cuenta y la asignación, en una sola transacción.
create or replace function public.streamer_create_admin(p_streamer uuid, p_username text, p_hash text, p_expires timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  perform 1 from admins where id = p_streamer and role = 'streamer' and status = 'active' for update;
  if not found then raise exception 'not a streamer' using hint = 'NOT_STREAMER'; end if;
  if (select count(*) from streamer_admins where streamer_id = p_streamer) >= 2 then
    raise exception 'team full' using hint = 'TEAM_FULL';
  end if;
  insert into admins (username, role, password_hash, must_change_password, password_expires_at, created_by)
  values (p_username, 'admin', p_hash, true, p_expires, p_streamer)
  returning id into v_id;
  insert into streamer_admins (streamer_id, admin_id, added_by) values (p_streamer, v_id, p_streamer);
  return v_id;
end $$;

-- Restablecer la contraseña del Owner a la de configuración (ADMIN_PASSWORD_HASH).
-- Cierra todas sus sesiones y le obliga a elegir una nueva al entrar. Opcionalmente quita su 2FA
-- (tendrá que volver a activarlo antes de poder usar el panel).
create or replace function public.owner_reset_password(p_hash text, p_expires timestamptz, p_clear_totp boolean)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare v_name text;
begin
  update admins set
    password_hash        = p_hash,
    must_change_password = true,
    password_expires_at  = p_expires,
    session_version      = session_version + 1,
    totp_secret_enc      = case when p_clear_totp then null else totp_secret_enc end,
    totp_enabled_at      = case when p_clear_totp then null else totp_enabled_at end,
    totp_last_step       = case when p_clear_totp then null else totp_last_step end,
    updated_at           = now()
  where role = 'owner'
  returning username into v_name;
  if v_name is null then raise exception 'no owner' using hint = 'NOT_FOUND'; end if;
  return v_name;
end $$;

revoke all on function public.streamer_sign_in(text, text, text, text, int) from public, anon, authenticated;
revoke all on function public.assign_streamer_admin(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.streamer_create_admin(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.owner_reset_password(text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.streamer_sign_in(text, text, text, text, int) to service_role;
grant execute on function public.assign_streamer_admin(uuid, uuid, uuid) to service_role;
grant execute on function public.streamer_create_admin(uuid, text, text, timestamptz) to service_role;
grant execute on function public.owner_reset_password(text, timestamptz, boolean) to service_role;

-- ---------------------------------------------------------------------
-- Almacenamiento: bucket PRIVADO con límites de tamaño y tipo
-- (20 MB: el máximo de un vídeo; las fotos se limitan a 6 MB en el servidor)
-- (Supabase rechaza en origen cualquier archivo que no cumpla).
-- No se crean políticas en storage.objects => el público no puede
-- listar, leer ni borrar. Solo se sube con URLs firmadas de un uso
-- que genera el servidor, y solo se ve con URLs firmadas temporales.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-media', 'room-media', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
