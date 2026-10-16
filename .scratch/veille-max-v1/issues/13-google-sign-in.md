# 13: Google sign-in

**What to build:** An invited traveller can sign in with Google in addition to the email code. It uses a full-page PKCE redirect whose callback sits inside the PWA scope, so it should land back in the installed app. Sign in with Apple is out of scope. See "Auth" in the spec and the iOS auth facts in the research note.

**Blocked by:** 02 (Sign in with an email code)

**Status:** ready-for-agent

- [ ] The sign-in screen offers « Continuer avec Google ». It uses the Supabase Google provider with a full-page redirect (no popup) and PKCE, and the callback URL is inside the manifest scope.
- [ ] Sign-ups stay closed: a Google account that is not an invited traveller is refused with a clear message.
- [ ] The setup is documented (Google Auth Platform client, authorised redirect URIs, Supabase provider settings), with no secret in the repo.
- [ ] Playwright: the button starts a redirect to the expected provider URL (real Google is not automated).
- [ ] Manual iPhone check: signing in with Google from the installed PWA returns to the standalone app signed in. If it does not, hide the button in standalone mode and document why.
