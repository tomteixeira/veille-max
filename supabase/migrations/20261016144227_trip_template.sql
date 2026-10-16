-- Trip template (ticket 03): the station reference, and each traveller's
-- default settings for the two legs of a trip, with their ranked routes.

-- 1. Stations.
-- Global reference data, owned by no traveller (ADR 0002): the 5-character SNCF
-- codes of the `tgvmax` dataset with their full names. Filled by the migrations
-- that `npm run stations:refresh` generates; never written at runtime.
create table public.stations (
  code text primary key check (code ~ '^[A-Z]{5}$'),
  name text not null check (name <> '')
);

comment on table public.stations is 'Station codes of the tgvmax dataset with their full names. Read by signed-in travellers, written by migrations only.';

alter table public.stations enable row level security;

revoke all on table public.stations from anon, authenticated;
grant select on table public.stations to authenticated;

create policy "Signed-in travellers read the stations"
  on public.stations for select
  to authenticated
  using (true);

-- 2. Template legs.
-- One row per traveller and leg. A traveller without a row for a leg uses the
-- default leg settings of the domain (shared/domain/trip-template.ts).
create type public.leg_kind as enum ('outbound', 'return');

-- Whether a leg's time window and ideal time apply to the departure or to the arrival.
create type public.time_anchor as enum ('departure', 'arrival');

create table public.template_legs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.leg_kind not null,
  -- ISO weekday: 1 is Monday, 7 is Sunday.
  weekday smallint not null check (weekday between 1 and 7),
  anchor public.time_anchor not null,
  -- Optional bounds of the time window, in Paris time: on or after `window_start`,
  -- on or before `window_end`.
  window_start time,
  window_end time,
  ideal_time time not null,
  primary key (user_id, kind),
  constraint template_legs_window_order check (window_start < window_end)
);

comment on table public.template_legs is 'Trip template: each traveller''s default settings for the outbound and return legs.';

-- 3. Template routes.
-- The ranked routes of a template leg; rank 1 is the most preferred.
create table public.template_routes (
  user_id uuid not null default auth.uid(),
  leg_kind public.leg_kind not null,
  rank smallint not null check (rank >= 1),
  origin_code text not null references public.stations (code),
  destination_code text not null references public.stations (code),
  primary key (user_id, leg_kind, rank),
  foreign key (user_id, leg_kind) references public.template_legs (user_id, kind) on delete cascade,
  -- The same route cannot appear twice in a leg.
  constraint template_routes_once_per_leg unique (user_id, leg_kind, origin_code, destination_code),
  constraint template_routes_two_stations check (origin_code <> destination_code)
);

comment on table public.template_routes is 'Trip template: the ranked routes of each template leg.';

-- 4. Row-level security: a traveller only ever reads and writes their own template.
alter table public.template_legs enable row level security;
alter table public.template_routes enable row level security;

revoke all on table public.template_legs, public.template_routes from anon, authenticated;
grant select, insert, update, delete on table public.template_legs, public.template_routes to authenticated;

create policy "Travellers read their template legs"
  on public.template_legs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their template legs"
  on public.template_legs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their template legs"
  on public.template_legs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their template legs"
  on public.template_legs for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Travellers read their template routes"
  on public.template_routes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their template routes"
  on public.template_routes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their template routes"
  on public.template_routes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their template routes"
  on public.template_routes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. Saving a leg.
-- Replaces the signed-in traveller's settings and ranked routes for one leg in
-- a single transaction. Runs with the caller's rights, so RLS still applies.
-- `routes` is a JSON array, in rank order, of {"origin_code", "destination_code"}.
create function public.save_template_leg(
  kind public.leg_kind,
  weekday smallint,
  anchor public.time_anchor,
  ideal_time time,
  routes jsonb,
  window_start time default null,
  window_end time default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.template_legs (user_id, kind, weekday, anchor, window_start, window_end, ideal_time)
  values (
    (select auth.uid()),
    save_template_leg.kind,
    save_template_leg.weekday,
    save_template_leg.anchor,
    save_template_leg.window_start,
    save_template_leg.window_end,
    save_template_leg.ideal_time
  )
  on conflict on constraint template_legs_pkey do update set
    weekday = excluded.weekday,
    anchor = excluded.anchor,
    window_start = excluded.window_start,
    window_end = excluded.window_end,
    ideal_time = excluded.ideal_time;

  delete from public.template_routes as route
  where route.user_id = (select auth.uid()) and route.leg_kind = save_template_leg.kind;

  insert into public.template_routes (user_id, leg_kind, rank, origin_code, destination_code)
  select
    (select auth.uid()),
    save_template_leg.kind,
    ranked.rank,
    ranked.route ->> 'origin_code',
    ranked.route ->> 'destination_code'
  from jsonb_array_elements(save_template_leg.routes) with ordinality as ranked (route, rank);
end;
$$;

comment on function public.save_template_leg is 'Saves one leg of the signed-in traveller''s trip template with its ranked routes. Signed-in travellers only.';

grant execute on function public.save_template_leg to authenticated;
