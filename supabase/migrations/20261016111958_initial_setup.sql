-- Initial setup: conventions every later migration builds on.

-- 1. Functions are private by default.
-- Supabase lets anon and authenticated call any new function in `public`
-- through the Data API. Here a function is only callable by the roles a
-- migration grants it to, explicitly, next to its definition.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 2. Liveness probe behind GET /api/health.
-- A successful call proves that the server reaches Postgres through the Data
-- API with its secret key, and that migrations have run.
create function public.health()
returns text
language sql
stable
set search_path = ''
as $$
  select 'ok'::text
$$;

comment on function public.health() is 'Liveness probe for GET /api/health. Server role only.';

grant execute on function public.health() to service_role;
