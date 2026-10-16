-- Push subscriptions (ticket 09): the devices on which a traveller turned
-- notifications on. A traveller can have several devices; a device belongs to
-- one traveller at a time.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The push service URL of the subscription, unique to one browser on one device.
  endpoint text not null unique check (endpoint ~ '^https://'),
  -- The subscription's keys (base64url), which encrypt every payload sent to it.
  p256dh text not null check (p256dh <> ''),
  auth text not null check (auth <> ''),
  -- What the traveller sees in their device list, e.g. « iPhone ».
  device_label text not null check (device_label <> ''),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is 'Each traveller''s devices with notifications turned on: their Web Push subscription and a label.';

-- Row-level security: a traveller only ever reads and removes their own devices.
-- The server role reads every device to send notifications, and removes the
-- ones the push service reports gone.
alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;

create policy "Travellers read their devices"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Travellers add their devices"
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travellers remove their devices"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Registering a device.
-- Turning notifications on gives the signed-in traveller this device's
-- subscription, with fresh keys. The same browser can sign in as another
-- traveller: the subscription then moves to them, so the previous one stops
-- receiving their notifications there. That row is not theirs to update under
-- RLS, hence `security definer`; knowing the endpoint, a secret URL handed out
-- by the push service, stands for holding the device.
create function public.register_push_device(endpoint text, p256dh text, auth text, device_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Only a signed-in traveller can register a device' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values ((select auth.uid()), register_push_device.endpoint, register_push_device.p256dh, register_push_device.auth, register_push_device.device_label)
  on conflict on constraint push_subscriptions_endpoint_key do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    device_label = excluded.device_label,
    created_at = case
      when public.push_subscriptions.user_id = excluded.user_id then public.push_subscriptions.created_at
      else now()
    end;
end;
$$;

comment on function public.register_push_device is 'Gives the signed-in traveller this device''s push subscription. Signed-in travellers only.';

revoke execute on function public.register_push_device from public, anon;
grant execute on function public.register_push_device to authenticated;
