-- =====================================================================
--  Room Review — esquema de base de datos y almacenamiento (Supabase)
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

create index if not exists submissions_status_submitted_idx
  on public.submissions (status, submitted_at);

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
alter table public.submissions      enable row level security;
alter table public.submission_media enable row level security;
alter table public.rate_limits      enable row level security;

alter table public.submissions      force row level security;
alter table public.submission_media force row level security;
alter table public.rate_limits      force row level security;

revoke all on table public.submissions      from anon, authenticated;
revoke all on table public.submission_media from anon, authenticated;
revoke all on table public.rate_limits      from anon, authenticated;

-- ---------------------------------------------------------------------
-- Funciones (transaccionales y atómicas)
-- ---------------------------------------------------------------------

-- Crea una entrega y sus fotos en UNA transacción: o se guarda todo o nada.
drop function if exists public.create_submission(uuid, text, text, text, text, text, jsonb);
create or replace function public.create_submission(
  p_id uuid,
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
begin
  if v_count < 1 or v_count > 5 then
    raise exception 'invalid media count';
  end if;
  if p_consent_version is null or p_deletion_hash is null then
    raise exception 'consent required';
  end if;

  insert into submissions (id, username, email, country, description, upload_token_hash, media_count,
                           consent_at, consent_version, deletion_token_hash)
  values (p_id, p_username, p_email, p_country, p_description, p_token_hash, v_count,
          now(), p_consent_version, p_deletion_hash);

  insert into submission_media (submission_id, storage_path, position, content_type)
  select p_id, m->>'path', (m->>'position')::smallint, m->>'content_type'
  from jsonb_array_elements(p_media) as m;

  return p_id;
end $$;

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

revoke all on function public.create_submission(uuid, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.create_submission(uuid, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------------
-- Almacenamiento: bucket PRIVADO con límites de tamaño y tipo
-- (Supabase rechaza en origen cualquier archivo que no cumpla).
-- No se crean políticas en storage.objects => el público no puede
-- listar, leer ni borrar. Solo se sube con URLs firmadas de un uso
-- que genera el servidor, y solo se ve con URLs firmadas temporales.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-media', 'room-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
