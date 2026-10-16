-- Improvement notifications (ticket 10): the reference best candidate of each
-- traveller's legs, the improvements in the notification log, and which
-- snapshots the tick has evaluated (CONTEXT.md, Improvement).

-- 1. Evaluated snapshots.
-- After ingesting a snapshot, the tick evaluates every traveller against it,
-- then stamps it. A tick that stopped before stamping it evaluates it again.
alter table public.snapshots add column evaluated_at timestamptz;

comment on column public.snapshots.evaluated_at is 'When the tick evaluated every traveller against this snapshot and sent its improvements; null until then.';

-- 2. Leg references.
-- The best candidate each leg had at the last evaluation, or none: the next
-- snapshot's best candidate improves on it when it ranks strictly above it.
-- Updated for muted legs too, so unmuting one does not flood the traveller.
create table public.leg_references (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  leg_kind public.leg_kind not null,
  -- The snapshot the reference was evaluated against.
  snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  -- The best candidate, all null when the leg had none. Its times are kept, so
  -- it can be ranked once it no longer shows a seat.
  travel_date date,
  train_number text,
  origin_code text,
  destination_code text,
  departure_time time,
  arrival_time time,
  updated_at timestamptz not null default now(),
  primary key (user_id, trip_key, leg_kind),
  constraint leg_references_whole_train check (
    num_nulls(travel_date, train_number, origin_code, destination_code, departure_time, arrival_time) in (0, 6)
  )
);

comment on table public.leg_references is 'The best candidate of each traveller''s legs at the last evaluation, or none: what the next snapshot must beat to notify.';

-- A traveller reads and resets their own references after changing their
-- settings (spec, "Settings writes"); the tick writes them with the server role.
alter table public.leg_references enable row level security;

revoke all on table public.leg_references from anon, authenticated;
grant select, insert, update, delete on table public.leg_references to authenticated;

create policy "Travellers read their leg references"
  on public.leg_references for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their leg references"
  on public.leg_references for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their leg references"
  on public.leg_references for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their leg references"
  on public.leg_references for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. The notification log (spec, "Data model"): every notification the tick
-- sent, written before sending it, so that a re-run never sends it again.
-- Confirmation Reminders (ticket 11) share it: whichever of the two tickets
-- lands first creates it, the other extends it.
do $$
begin
  create type public.notification_kind as enum ('improvement');
exception when duplicate_object then null;
end;
$$;

alter type public.notification_kind add value if not exists 'improvement';

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null,
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  leg_kind public.leg_kind not null,
  sent_at timestamptz not null default now()
);

comment on table public.notification_log is 'Every notification the tick sent each traveller, so that it never sends one twice. Read by its traveller (« Nouveautés »).';

-- An improvement: the snapshot it was found in, its kind and its train. Null
-- for other notifications. (The new enum value cannot be used in the
-- transaction that adds it: improvements are told by their `improvement_kind`.)
alter table public.notification_log
  add column snapshot_id bigint references public.snapshots (id) on delete cascade,
  add column improvement_kind text check (improvement_kind in ('first-candidate', 'new-best', 'better-than-booking')),
  add column travel_date date,
  add column train_number text,
  add column origin_code text,
  add column destination_code text,
  add column departure_time time,
  add column arrival_time time,
  add constraint notification_log_improvement check (
    improvement_kind is null
    or num_nulls(snapshot_id, travel_date, train_number, origin_code, destination_code, departure_time, arrival_time) = 0
  );

-- One improvement per leg and snapshot.
create unique index notification_log_one_improvement
  on public.notification_log (user_id, trip_key, leg_kind, snapshot_id)
  where improvement_kind is not null;

-- « Nouveautés » reads a traveller's improvements of the latest snapshot.
create index notification_log_by_snapshot on public.notification_log (snapshot_id);

-- Row-level security: a traveller only ever reads their own notifications.
-- Only the server role writes them.
alter table public.notification_log enable row level security;

revoke all on table public.notification_log from anon, authenticated;
grant select on table public.notification_log to authenticated;

drop policy if exists "Travellers read their notifications" on public.notification_log;
create policy "Travellers read their notifications"
  on public.notification_log for select to authenticated
  using ((select auth.uid()) = user_id);
