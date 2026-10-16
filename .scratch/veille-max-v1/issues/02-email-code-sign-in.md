# 02: Sign in with an email code

**What to build:** An invited traveller signs in by typing a 6-digit code received by email, inside the app, and stays signed in. Strangers cannot create an account. See "Auth" in the spec. Magic links are excluded because they open in Safari, outside the installed PWA.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-human

- [x] The sign-in screen asks for an email, then for the 6-digit code; entering the right code signs the traveller in.
- [x] The email contains the code, not a magic link.
- [x] Public sign-ups are disabled: requesting a code never creates a user, and an uninvited email gets a neutral error message.
- [x] The session survives closing and reopening the app (long-lived session).
- [x] Every page except sign-in requires authentication; unauthenticated visits are redirected to sign-in.
- [x] Réglages shows the signed-in email and a sign-out action.
- [x] Playwright: an invited seeded traveller signs in with the code read from the local mail catcher; an uninvited email is refused; sign-out works.

## Comments

- 2026-10-16 — Local work done. Lint, typecheck, Vitest and Playwright pass, Playwright against a production build. Decisions made while implementing:
  - **Sign-ups closed** with `enable_signup = false` under `[auth]`. `[auth.email] enable_signup` must stay `true`: despite its name, the CLI turns the whole email provider off with it. The app also asks for codes with `shouldCreateUser: false`.
  - **Invitations.** An invitation whose link was never opened is refused like an unknown address (`signup_disabled` instead of `otp_disabled`): Supabase treats that first code request as a sign-up. Both get the same neutral message. The README recommends « Create new user » with « Auto Confirm User » in the dashboard.
  - **The email** is Supabase's « Magic Link » template, rewritten in French with the code only (`supabase/templates/sign-in-code.html`).
  - **Long-lived session.** The auth cookies are kept 400 days, the longest browsers allow; the `@nuxtjs/supabase` default was 8 hours. Supabase refresh tokens do not expire. « Se déconnecter » uses `scope: 'local'`: it ends this device's session, on the server too, and leaves the other devices signed in.
  - **Back to the requested page** after sign-in (`saveRedirectToCookie`), ready for notification deep links (ticket 10).
  - **Controls wait for hydration** (`useInteractive`). Before it, a fast tap reloaded the sign-in form and text typed in it was lost. Later pages with forms should do the same.
  - **End-to-end auth.** A Playwright setup project signs the seeded traveller in once through the screen; the other tests reuse its browser state. A test that signs out must sign in on its own, since signing out revokes the shared session.
  - **Not verified on a device:** Safari caps cookies written from JavaScript to 7 days (ITP). The server also rewrites the auth cookies whenever it refreshes the session during a page load. Check on the iPhone that the app is still signed in after a week without opening it.
- Steps left to the user (status `ready-for-human`):
  1. **Hosted Supabase Auth settings** (README, Deploy, step 1): close sign-ups, put the code template in « Magic Link », check the Site URL. Do it before this work reaches production: the hosted default email has a link and no code, so nobody could sign in there.
  2. **Custom SMTP** before inviting anyone outside the Supabase organisation.
  3. **Invite yourself** (README, Sign-in) and sign in on the iPhone. Check that iOS offers the code from Mail above the keyboard.
