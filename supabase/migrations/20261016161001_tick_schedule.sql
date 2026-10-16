-- Tick schedule (ticket 04, ADR 0003): every 15 minutes, `pg_cron` calls the
-- app's tick endpoint through `pg_net`. The endpoint decides what is due.
--
-- The endpoint's URL and shared secret live in Vault, so that no environment's
-- address or secret is in the repository:
--   select vault.create_secret('https://<domain>/api/cron/tick', 'tick_url');
--   select vault.create_secret('<the NUXT_TICK_SECRET of the app>', 'tick_secret');
-- Until both exist (a fresh local stack), the job runs and calls nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := settings.url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tick-secret', settings.secret),
    body := '{}'::jsonb,
    -- pg_net gives up after 2 s by default; an ingestion takes longer.
    timeout_milliseconds := 120000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'tick_url') as url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'tick_secret') as secret
  ) as settings
  where settings.url is not null and settings.secret is not null
  $$
);
