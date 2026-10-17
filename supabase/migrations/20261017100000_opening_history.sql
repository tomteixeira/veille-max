-- Dashboard: when seats come out (ticket 14). The availability history of a
-- set of routes, counted from the observations and openings of every ingested
-- snapshot and grouped by the weekday (ISO, 1 is Monday) of the trains' travel
-- date. The server turns the groups into the dashboard's charts
-- (shared/domain/opening-history.ts).
--
-- Snapshots are counted by their rank in time: a train listed from its first
-- to its last snapshot was listed by every snapshot in between, and an opening
-- covers every snapshot from its first to its last.
--
-- An opening's start is known when its train was seen without a seat before,
-- or when the train was first seen at the edge of the 30-day booking window,
-- before which no seat exists. Otherwise the seat was already open when the
-- train was first seen (at the first snapshot, or when its route started being
-- tracked): when it came out, and how long it lasted, are unknown, so it counts
-- in neither the opening curve nor the lifetimes.

create function public.opening_history(routes jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with snapshot as (
    select
      id,
      processed_at,
      row_number() over (order by processed_at) as rank,
      (processed_at at time zone 'Europe/Paris')::date as paris_day
    from public.snapshots
  ),
  route as (
    select origin_code, destination_code
    from jsonb_to_recordset(opening_history.routes) as route (origin_code text, destination_code text)
  ),
  observation as (
    select
      observation.id,
      observation.travel_date,
      extract(isodow from observation.travel_date)::integer as weekday,
      extract(hour from observation.departure_time)::integer as hour,
      first_seen.rank as first_rank,
      last_seen.rank as last_rank,
      observation.travel_date - first_seen.paris_day as days_before_first_seen
    from public.train_observations as observation
    join route using (origin_code, destination_code)
    join snapshot as first_seen on first_seen.id = observation.first_snapshot_id
    join snapshot as last_seen on last_seen.id = observation.last_snapshot_id
  ),
  opening as (
    select
      observation.weekday,
      observation.hour,
      observation.travel_date - first_open.paris_day as days_before,
      last_open.paris_day - first_open.paris_day as days_open,
      first_open.rank as first_rank,
      last_open.rank as last_rank,
      first_open.rank > observation.first_rank or observation.days_before_first_seen >= 30 as start_known,
      -- Still listed after its last open snapshot: the seat was taken, the train did not just leave the dataset.
      observation.last_rank > last_open.rank as taken
    from public.openings as opening
    join observation on observation.id = opening.observation_id
    join snapshot as first_open on first_open.id = opening.first_snapshot_id
    join snapshot as last_open on last_open.id = opening.last_snapshot_id
  ),
  started as (
    select weekday, days_before, count(*) as openings
    from opening
    where start_known and days_before >= 0
    group by weekday, days_before
  ),
  listed as (
    select weekday, hour, sum(last_rank - first_rank + 1) as listed
    from observation
    group by weekday, hour
  ),
  open as (
    select weekday, hour, sum(last_rank - first_rank + 1) as open
    from opening
    group by weekday, hour
  ),
  lifetime as (
    select weekday, days_open, count(*) as openings
    from opening
    where start_known and taken
    group by weekday, days_open
  )
  select jsonb_build_object(
    'first_snapshot_at', (select min(processed_at) from snapshot),
    'starts', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', weekday, 'days_before', days_before, 'openings', openings))
      from started
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', listed.weekday, 'hour', listed.hour, 'listed', listed.listed, 'open', coalesce(open.open, 0)))
      from listed
      left join open using (weekday, hour)
    ), '[]'::jsonb),
    'lifetimes', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', weekday, 'days', days_open, 'openings', openings))
      from lifetime
    ), '[]'::jsonb)
  )
$$;

comment on function public.opening_history is 'The availability history of the given routes ([{"origin_code", "destination_code"}]), grouped by travel weekday: openings by days before departure, train-mornings by departure hour, lifetimes of the seats seen taken. Signed-in travellers.';

revoke execute on function public.opening_history from public, anon;
grant execute on function public.opening_history to authenticated, service_role;
