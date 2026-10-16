# 02: Sign in with an email code

**What to build:** An invited traveller signs in by typing a 6-digit code received by email, inside the app, and stays signed in. Strangers cannot create an account. See "Auth" in the spec. Magic links are excluded because they open in Safari, outside the installed PWA.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [ ] The sign-in screen asks for an email, then for the 6-digit code; entering the right code signs the traveller in.
- [ ] The email contains the code, not a magic link.
- [ ] Public sign-ups are disabled: requesting a code never creates a user, and an uninvited email gets a neutral error message.
- [ ] The session survives closing and reopening the app (long-lived session).
- [ ] Every page except sign-in requires authentication; unauthenticated visits are redirected to sign-in.
- [ ] Réglages shows the signed-in email and a sign-out action.
- [ ] Playwright: an invited seeded traveller signs in with the code read from the local mail catcher; an uninvited email is refused; sign-out works.
