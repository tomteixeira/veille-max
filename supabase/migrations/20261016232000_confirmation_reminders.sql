-- Confirmation Reminders (ticket 11): whether each traveller wants them, and a
-- notification log that keeps the tick from sending one twice.

-- 1. The « Rappel de confirmation » toggle of Réglages, on by default.
-- A traveller may now turn reminders off before choosing a route weight:
-- without one, the domain's default applies (DEFAULT_ROUTE_WEIGHT).
alter table public.traveller_settings
  alter column route_weight drop not null;

alter table public.traveller_settings
  add column confirmation_reminders boolean not null default true;

comment on column public.traveller_settings.confirmation_reminders is 'Whether the traveller gets a Confirmation Reminder at noon the day before each booked leg.';

-- 2. The notification log (spec, "Data model"): every notification the tick
-- sent, so that a re-run never sends it again. The tick records a notification
-- before sending it, and removes the record when no device could be reached,
-- so that the next tick tries again.
create type public.notification_kind as enum ('confirmation_reminder');

create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null,
  trip_key text not null check (trip_key ~ '^\d{4}-W\d{2}$'),
  leg_kind public.leg_kind not null,
  -- A Confirmation Reminder's booked train date: the leg it reminded of.
  reminder_date date,
  sent_at timestamptz not null default now(),
  constraint notification_log_reminder_date check (kind <> 'confirmation_reminder' or reminder_date is not null)
);

comment on table public.notification_log is 'Every notification the tick sent each traveller, so that it never sends one twice.';

-- One Confirmation Reminder per booked leg and date, even when the booking is replaced by another train.
create unique index notification_log_one_reminder
  on public.notification_log (user_id, trip_key, leg_kind, reminder_date)
  where kind = 'confirmation_reminder';

-- Row-level security: a traveller only ever reads their own notifications.
-- Only the server role writes them.
alter table public.notification_log enable row level security;

revoke all on table public.notification_log from anon, authenticated;
grant select on table public.notification_log to authenticated;

create policy "Travellers read their notifications"
  on public.notification_log for select to authenticated
  using ((select auth.uid()) = user_id);
