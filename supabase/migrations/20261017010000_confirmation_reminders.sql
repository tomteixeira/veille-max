-- Confirmation Reminders (ticket 11): whether each traveller wants them, and
-- their entries in the notification log (ticket 10), which keep the tick from
-- sending one twice.

-- 1. The « Rappel de confirmation » toggle of Réglages, on by default.
-- A traveller may now turn reminders off before choosing a route weight:
-- without one, the domain's default applies (DEFAULT_ROUTE_WEIGHT).
alter table public.traveller_settings
  alter column route_weight drop not null;

alter table public.traveller_settings
  add column if not exists confirmation_reminders boolean not null default true;

comment on column public.traveller_settings.confirmation_reminders is 'Whether the traveller gets a Confirmation Reminder at noon the day before each booked leg.';

-- 2. Confirmation Reminders in the notification log. The tick logs a reminder
-- before sending it, and removes the entry when no device could be reached,
-- so that the next tick tries again. (The new enum value cannot be used in
-- the transaction that adds it: the constraint reads it as text, and the
-- index tells reminders by their `reminder_date`.)
alter type public.notification_kind add value if not exists 'confirmation_reminder';

alter table public.notification_log
  -- A Confirmation Reminder's booked train date: the leg it reminded of. Null for other notifications.
  add column if not exists reminder_date date;

alter table public.notification_log
  drop constraint if exists notification_log_reminder_date,
  add constraint notification_log_reminder_date check ((kind::text = 'confirmation_reminder') = (reminder_date is not null));

-- One Confirmation Reminder per booked leg and date, even when the booking is replaced by another train.
drop index if exists public.notification_log_one_reminder;
create unique index notification_log_one_reminder
  on public.notification_log (user_id, trip_key, leg_kind, reminder_date)
  where reminder_date is not null;
