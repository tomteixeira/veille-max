-- Snapshot ingestion (ticket 04): the availability history of the travellers'
-- routes, one SNCF open-data snapshot at a time (ADR 0001). Global data, owned
-- by no traveller (ADR 0002): signed-in travellers read it, only the server
-- role writes it, through `record_snapshot`.

-- 1. Snapshots.
-- One row per ingested snapshot, keyed by the dataset's processed timestamp:
-- a snapshot is ingested once.
create table public.snapshots (
  id bigint generated always as identity primary key,
  -- The dataset's `data_processed` timestamp: when SNCF took the snapshot.
  processed_at timestamptz not null unique,
  -- When the app ingested it.
  ingested_at timestamptz not null,
  -- Trains listed on the tracked routes (duplicate rows merged), and how many
  -- of them had an open seat.
  row_count integer not null check (row_count >= 0),
  open_count integer not null check (open_count between 0 and row_count)
);

comment on table public.snapshots is 'Ingested SNCF open-data snapshots. Read by signed-in travellers, written by the server role.';

-- 2. Train observations.
-- One row per train, route and date ever seen on a tracked route, whatever its
-- availability, with the latest times SNCF gave for it.
create table public.train_observations (
  id bigint generated always as identity primary key,
  travel_date date not null,
  train_number text not null check (train_number <> ''),
  origin_code text not null references public.stations (code),
  destination_code text not null references public.stations (code),
  -- Paris time. An arrival earlier than the departure is on the next day.
  departure_time time not null,
  arrival_time time not null,
  first_snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  last_snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  constraint train_observations_once unique (travel_date, train_number, origin_code, destination_code)
);

comment on table public.train_observations is 'Every train seen on a tracked route, with the first and last snapshots that listed it. Read by signed-in travellers, written by the server role.';

create index train_observations_by_route on public.train_observations (origin_code, destination_code, travel_date);

-- 3. Openings.
-- A run of consecutive snapshots in which a train had an open MAX JEUNE seat
-- (CONTEXT.md). An opening stays open while every new snapshot shows the seat,
-- and closes at the first snapshot that does not.
create table public.openings (
  id bigint generated always as identity primary key,
  observation_id bigint not null references public.train_observations (id) on delete cascade,
  first_snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  last_snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  is_open boolean not null default true
);

comment on table public.openings is 'Runs of consecutive snapshots in which a train had an open MAX JEUNE seat. Read by signed-in travellers, written by the server role.';

-- A train has at most one opening in progress.
create unique index openings_one_open_per_train on public.openings (observation_id) where is_open;

-- 4. Row-level security: every signed-in traveller reads the availability history.
alter table public.snapshots enable row level security;
alter table public.train_observations enable row level security;
alter table public.openings enable row level security;

revoke all on table public.snapshots, public.train_observations, public.openings from anon, authenticated;
grant select on table public.snapshots, public.train_observations, public.openings to authenticated;

create policy "Signed-in travellers read the snapshots"
  on public.snapshots for select to authenticated
  using (true);
create policy "Signed-in travellers read the train observations"
  on public.train_observations for select to authenticated
  using (true);
create policy "Signed-in travellers read the openings"
  on public.openings for select to authenticated
  using (true);

-- 5. Tracked routes.
-- The routes whose availability is collected: the union of every traveller's
-- template routes. Customised trips will add theirs (ticket 07).
create function public.tracked_routes()
returns table (origin_code text, destination_code text)
language sql
stable
set search_path = ''
as $$
  select distinct route.origin_code, route.destination_code
  from public.template_routes as route
  order by route.origin_code, route.destination_code
$$;

comment on function public.tracked_routes is 'The routes the snapshot ingestion collects: every traveller''s template routes. Server role only.';

grant execute on function public.tracked_routes to service_role;

-- 6. Recording a snapshot.
-- In one transaction: records the snapshot, upserts the observation of every
-- train it lists, then extends, opens and closes the openings. `trains` is a
-- JSON array of {"date", "train_number", "origin_code", "destination_code",
-- "departure_time", "arrival_time", "open"}, at most one per train, route and
-- date. Returns the snapshot's id and counts, or null when a snapshot with the
-- same processed timestamp was already recorded: nothing changes then.
create function public.record_snapshot(processed_at timestamptz, ingested_at timestamptz, trains jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  new_snapshot_id bigint;
  kept_count integer;
  opened_count integer;
  closed_count integer;
begin
  insert into public.snapshots (processed_at, ingested_at, row_count, open_count)
  select
    record_snapshot.processed_at,
    record_snapshot.ingested_at,
    count(*),
    count(*) filter (where (train ->> 'open')::boolean)
  from jsonb_array_elements(record_snapshot.trains) as train
  on conflict (processed_at) do nothing
  returning id into new_snapshot_id;

  if new_snapshot_id is null then
    return null;
  end if;

  insert into public.train_observations as observation (
    travel_date, train_number, origin_code, destination_code,
    departure_time, arrival_time, first_snapshot_id, last_snapshot_id
  )
  select
    train.date, train.train_number, train.origin_code, train.destination_code,
    train.departure_time, train.arrival_time, new_snapshot_id, new_snapshot_id
  from jsonb_to_recordset(record_snapshot.trains) as train (
    date date, train_number text, origin_code text, destination_code text,
    departure_time time, arrival_time time
  )
  on conflict on constraint train_observations_once do update set
    departure_time = excluded.departure_time,
    arrival_time = excluded.arrival_time,
    last_snapshot_id = excluded.last_snapshot_id;

  -- Trains with an open seat: their opening in progress goes on, or a new one starts.
  with open_now as (
    select observation.id
    from jsonb_to_recordset(record_snapshot.trains) as train (
      date date, train_number text, origin_code text, destination_code text, open boolean
    )
    join public.train_observations as observation
      on observation.travel_date = train.date
      and observation.train_number = train.train_number
      and observation.origin_code = train.origin_code
      and observation.destination_code = train.destination_code
    where train.open
  ),
  kept as (
    update public.openings as opening
    set last_snapshot_id = new_snapshot_id
    where opening.is_open and opening.observation_id in (select id from open_now)
    returning opening.observation_id
  ),
  opened as (
    insert into public.openings (observation_id, first_snapshot_id, last_snapshot_id)
    select open_now.id, new_snapshot_id, new_snapshot_id
    from open_now
    where open_now.id not in (select observation_id from kept)
    returning id
  )
  select (select count(*) from kept), (select count(*) from opened)
  into kept_count, opened_count;

  -- Every other opening in progress ends with the previous snapshot: its train
  -- shows no seat any more, has left the dataset, or is no longer tracked.
  update public.openings as opening
  set is_open = false
  where opening.is_open and opening.last_snapshot_id <> new_snapshot_id;
  get diagnostics closed_count = row_count;

  return jsonb_build_object(
    'snapshot_id', new_snapshot_id,
    'openings_opened', opened_count,
    'openings_kept', kept_count,
    'openings_closed', closed_count
  );
end;
$$;

comment on function public.record_snapshot is 'Records one SNCF snapshot of the tracked routes: observations and openings. Server role only.';

grant execute on function public.record_snapshot to service_role;
