-- Onboarding (ticket 12): where each traveller stands in the 3-step flow they
-- go through after their first sign-in, and whether the app ever ran from the
-- home screen of one of their devices. The other two steps are read from the
-- traveller's data: a ranked route in their template, a push device.

-- A traveller may now hold onboarding progress before choosing a route weight:
-- without one, the domain's default applies (DEFAULT_ROUTE_WEIGHT).
alter table public.traveller_settings
  alter column route_weight drop not null;

alter table public.traveller_settings
  -- The step the flow shows the traveller (shared/domain/onboarding.ts); `done`
  -- once they finished or skipped the last step. Without a row, the first step.
  add column onboarding_step text not null default 'configuration'
    check (onboarding_step in ('configuration', 'installation', 'notifications', 'done')),
  -- When the app first ran from the home screen (standalone display mode).
  add column installed_at timestamptz;

comment on table public.traveller_settings is 'Each traveller''s settings outside the trip template: the route weight and their onboarding progress.';

-- Travellers who signed in before onboarding existed have set up the app already:
-- the flow is for new travellers, and the banner reminds them of anything missing.
insert into public.traveller_settings (user_id, onboarding_step)
select id, 'done' from auth.users
on conflict (user_id) do update set onboarding_step = 'done';
