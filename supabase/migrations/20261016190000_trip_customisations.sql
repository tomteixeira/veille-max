-- Customise, reset and mute trips (ticket 07): the leg settings of each
-- traveller's customised trips, and their muted trips and legs. A trip is
-- identified by the ISO year-week of its default outbound date (« 2026-W43 »),
-- which does not change when its dates are customised.

-- 1. Customised trip legs.
-- A customised trip has a row for each of its two legs: the first change copies
-- the trip template's settings of both legs into the trip (copy-on-write).
-- Resetting the trip deletes its rows.
create table public.customised_trip_legs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  kind public.leg_kind not null,
  -- The leg's own date, in Paris.
  travel_date date not null,
  anchor public.time_anchor not null,
  -- Optional bounds of the time window, in Paris time: on or after `window_start`,
  -- on or before `window_end`.
  window_start time,
  window_end time,
  ideal_time time not null,
  primary key (user_id, trip_key, kind),
  constraint customised_trip_legs_window_order check (window_start < window_end)
);

comment on table public.customised_trip_legs is 'Customised trips: each traveller''s own settings for both legs of a trip, detached from the trip template.';

-- The snapshot ingestion looks the customised legs up by date.
create index customised_trip_legs_by_date on public.customised_trip_legs (travel_date);

-- 2. Customised trip routes.
-- The ranked routes of a customised leg; rank 1 is the most preferred.
create table public.customised_trip_routes (
  user_id uuid not null default auth.uid(),
  trip_key text not null,
  leg_kind public.leg_kind not null,
  rank smallint not null check (rank >= 1),
  origin_code text not null references public.stations (code),
  destination_code text not null references public.stations (code),
  primary key (user_id, trip_key, leg_kind, rank),
  foreign key (user_id, trip_key, leg_kind) references public.customised_trip_legs (user_id, trip_key, kind) on delete cascade,
  -- The same route cannot appear twice in a leg.
  constraint customised_trip_routes_once_per_leg unique (user_id, trip_key, leg_kind, origin_code, destination_code),
  constraint customised_trip_routes_two_stations check (origin_code <> destination_code)
);

comment on table public.customised_trip_routes is 'Customised trips: the ranked routes of each customised leg.';

-- 3. Mutes.
-- A muted trip (no `leg_kind`) or a single muted leg: still tracked and shown,
-- never notified.
create table public.mutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  leg_kind public.leg_kind,
  constraint mutes_once unique nulls not distinct (user_id, trip_key, leg_kind)
);

comment on table public.mutes is 'Muted trips (no leg kind) and muted legs of each traveller: tracked and shown, never notified.';

-- 4. Row-level security: a traveller only ever reads and writes their own customisations and mutes.
alter table public.customised_trip_legs enable row level security;
alter table public.customised_trip_routes enable row level security;
alter table public.mutes enable row level security;

revoke all on table public.customised_trip_legs, public.customised_trip_routes, public.mutes from anon, authenticated;
grant select, insert, update, delete on table public.customised_trip_legs, public.customised_trip_routes to authenticated;
-- A mute is added or removed, never changed.
grant select, insert, delete on table public.mutes to authenticated;

create policy "Travellers read their customised trip legs"
  on public.customised_trip_legs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their customised trip legs"
  on public.customised_trip_legs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their customised trip legs"
  on public.customised_trip_legs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their customised trip legs"
  on public.customised_trip_legs for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Travellers read their customised trip routes"
  on public.customised_trip_routes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their customised trip routes"
  on public.customised_trip_routes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their customised trip routes"
  on public.customised_trip_routes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their customised trip routes"
  on public.customised_trip_routes for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Travellers read their mutes"
  on public.mutes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their mutes"
  on public.mutes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their mutes"
  on public.mutes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. Saving a customised trip.
-- Replaces the signed-in traveller's settings and ranked routes for both legs
-- of a trip in a single transaction. Runs with the caller's rights, so RLS
-- still applies. `legs` is a JSON array of {"kind", "travel_date", "anchor",
-- "window_start", "window_end", "ideal_time", "routes"}, `routes` being a JSON
-- array, in rank order, of {"origin_code", "destination_code"}.
create function public.save_customised_trip(trip_key text, legs jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.customised_trip_legs as leg
  where leg.user_id = (select auth.uid()) and leg.trip_key = save_customised_trip.trip_key;

  insert into public.customised_trip_legs (user_id, trip_key, kind, travel_date, anchor, window_start, window_end, ideal_time)
  select (select auth.uid()), save_customised_trip.trip_key, leg.kind, leg.travel_date, leg.anchor, leg.window_start, leg.window_end, leg.ideal_time
  from jsonb_to_recordset(save_customised_trip.legs) as leg (
    kind public.leg_kind, travel_date date, anchor public.time_anchor, window_start time, window_end time, ideal_time time
  );

  insert into public.customised_trip_routes (user_id, trip_key, leg_kind, rank, origin_code, destination_code)
  select
    (select auth.uid()),
    save_customised_trip.trip_key,
    (leg ->> 'kind')::public.leg_kind,
    ranked.rank,
    ranked.route ->> 'origin_code',
    ranked.route ->> 'destination_code'
  from jsonb_array_elements(save_customised_trip.legs) as leg
  cross join lateral jsonb_array_elements(leg -> 'routes') with ordinality as ranked (route, rank);
end;
$$;

comment on function public.save_customised_trip is 'Saves both legs of one of the signed-in traveller''s customised trips with their ranked routes. Signed-in travellers only.';

grant execute on function public.save_customised_trip to authenticated;

-- 6. Tracked routes.
-- The routes whose availability is collected from `from_date` to `to_date`:
-- every traveller's template routes, and the routes of their customised legs
-- dated within that range.
drop function public.tracked_routes();

create function public.tracked_routes(from_date date, to_date date)
returns table (origin_code text, destination_code text)
language sql
stable
set search_path = ''
as $$
  select route.origin_code, route.destination_code
  from public.template_routes as route
  union
  select route.origin_code, route.destination_code
  from public.customised_trip_routes as route
  join public.customised_trip_legs as leg
    on leg.user_id = route.user_id and leg.trip_key = route.trip_key and leg.kind = route.leg_kind
  where leg.travel_date between tracked_routes.from_date and tracked_routes.to_date
  order by origin_code, destination_code
$$;

comment on function public.tracked_routes is 'The routes the snapshot ingestion collects over a date range: every traveller''s template routes, and the routes of customised legs in that range. Server role only.';

revoke execute on function public.tracked_routes from public, anon, authenticated;
grant execute on function public.tracked_routes to service_role;
