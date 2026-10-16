-- Bookings (ticket 08): the train each traveller declared they reserved for a
-- leg (CONTEXT.md, Booking). Traveller-owned (ADR 0002): written from the app
-- under RLS (spec, "Settings writes").

-- At most one booking per trip and leg: declaring a new one replaces it.
create table public.bookings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The ISO year-week of the trip's default outbound date, « 2026-W43 ».
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  leg_kind public.leg_kind not null,
  -- The booked train, as the snapshots list it: open or not.
  travel_date date not null,
  train_number text not null,
  origin_code text not null,
  destination_code text not null,
  booked_at timestamptz not null default now(),
  primary key (user_id, trip_key, leg_kind),
  foreign key (travel_date, train_number, origin_code, destination_code)
    references public.train_observations (travel_date, train_number, origin_code, destination_code)
    on delete cascade
);

comment on table public.bookings is 'The train each traveller declared they reserved for a leg, at most one per trip and leg.';

create index bookings_by_train on public.bookings (travel_date, train_number, origin_code, destination_code);

-- Row-level security: a traveller only ever reads and writes their own bookings.
alter table public.bookings enable row level security;

revoke all on table public.bookings from anon, authenticated;
grant select, insert, update, delete on table public.bookings to authenticated;

create policy "Travellers read their bookings"
  on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their bookings"
  on public.bookings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers change their bookings"
  on public.bookings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Travellers cancel their bookings"
  on public.bookings for delete to authenticated
  using ((select auth.uid()) = user_id);
