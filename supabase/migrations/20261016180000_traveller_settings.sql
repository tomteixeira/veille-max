-- Traveller settings (ticket 06): each traveller's own settings that are not
-- part of the trip template, starting with the route weight.

create table public.traveller_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- How many minutes outside the time window one step of route rank is worth
  -- when ranking out-of-window candidates (CONTEXT.md, Route Weight). A
  -- traveller without a row uses the domain's default (DEFAULT_ROUTE_WEIGHT);
  -- the upper bound is MAX_ROUTE_WEIGHT (shared/domain/evaluation.ts).
  route_weight smallint not null check (route_weight between 0 and 120)
);

comment on table public.traveller_settings is 'Each traveller''s settings outside the trip template: the route weight.';

-- Row-level security: a traveller only ever reads and writes their own settings.
alter table public.traveller_settings enable row level security;

revoke all on table public.traveller_settings from anon, authenticated;
grant select, insert, update on table public.traveller_settings to authenticated;

create policy "Travellers read their settings"
  on public.traveller_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their settings"
  on public.traveller_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their settings"
  on public.traveller_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
