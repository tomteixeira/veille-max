# 13: Google sign-in

**What to build:** An invited traveller can sign in with Google in addition to the email code. It uses a full-page PKCE redirect whose callback sits inside the PWA scope, so it should land back in the installed app. Sign in with Apple is out of scope. See "Auth" in the spec and the iOS auth facts in the research note.

**Blocked by:** 02 (Sign in with an email code)

**Status:** ready-for-agent

- [x] The sign-in screen offers « Continuer avec Google ». It uses the Supabase Google provider with a full-page redirect (no popup) and PKCE, and the callback URL is inside the manifest scope.
- [x] Sign-ups stay closed: a Google account that is not an invited traveller is refused with a clear message.
- [x] The setup is documented (Google Auth Platform client, authorised redirect URIs, Supabase provider settings), with no secret in the repo. README, "Sign-in" and "Deploy".
- [x] Playwright: the button starts a redirect to the expected provider URL (real Google is not automated).
- [ ] Manual iPhone check: signing in with Google from the installed PWA returns to the standalone app signed in. If it does not, hide the button in standalone mode and document why. Written in `docs/manual-iphone-checklist.md`; to run on a device once Google is set up on the hosted project.

## Comments

- 2026-10-16 — The refusal of an uninvited Google account is Supabase's own: with sign-ups closed, its callback sends the traveller back to `/confirm` with `error_code=signup_disabled`, which the page turns into « Ce compte Google n’a pas accès à Veille MAX ». Playwright stands in for that redirect, since real Google is not automated. Playwright also checks that a callback whose code cannot be traded for a session (the PKCE verifier stayed in another browser, the failure to expect on the iPhone) says the sign-in did not finish rather than failing silently.
