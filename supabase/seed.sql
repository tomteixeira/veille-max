-- Local and CI seed data, loaded by `supabase db reset` after the migrations.
-- Fixture travellers and snapshots arrive with the tickets that need them.

-- Invited traveller used by the end-to-end tests (test/e2e). It signs in with
-- the code the local mail catcher receives. Sign-ups are closed, so a traveller
-- must exist, with a confirmed email, before they can request a code: an
-- invitation left unopened is refused like an unknown address.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'voyageur@veille-max.test', '', now(),
  '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
  '{"sub": "11111111-1111-4111-8111-111111111111", "email": "voyageur@veille-max.test", "email_verified": true}',
  'email', now(), now()
);

-- The invited traveller has been through onboarding (ticket 12): the tests land
-- on the home screen. The onboarding test invites a traveller of its own.
insert into public.traveller_settings (user_id, onboarding_step)
values ('11111111-1111-4111-8111-111111111111', 'done');
