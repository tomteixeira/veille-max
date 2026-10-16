# 09: Installable PWA and push devices

**What to build:** The app can be installed on the iPhone home screen, and the traveller can turn on notifications for each device. A test notification proves the whole chain works. This slice introduces the `PushGateway` port. See "Notifications" and the Web Push facts in `docs/research/tgvmax-data-source.md`.

**Blocked by:** 02 (Sign in with an email code)

**Status:** ready-for-agent

- [ ] The web app manifest has `display: standalone`, an explicit scope, icons and theme colours for both themes. It is served correctly in production on Vercel (check the known Nuxt 4 manifest-404 issue).
- [ ] A custom service worker (inject-manifest strategy) shows a visible notification for every push and, on click, opens the in-scope URL carried by the payload.
- [ ] Réglages has a Notifications card. Its « Notifications sur cet iPhone » toggle enables and disables notifications on this device; the permission request and the subscription happen inside the tap. The card also lists the traveller's devices, marking « Cet appareil », and has « Envoyer une notification de test ».
- [ ] Push subscriptions are stored per traveller with a device label, protected by RLS. A traveller can have several devices.
- [ ] The `PushGateway` port has a real Web Push adapter using VAPID keys from environment variables. Subscriptions reported gone (404/410) are deleted.
- [ ] Integration (seam 2, recording fake gateway): a test notification reaches every device of the traveller and only theirs; a gone subscription is deleted.
- [ ] Playwright: the notification settings states render (permission mocked).
- [ ] Manual iPhone checklist: install to the home screen, enable notifications, receive the test notification, tap opens the app.

## Comments

- 2026-10-16 — From ticket 02: check the session lifetime once the service worker is in. Safari caps cookies written from JavaScript to 7 days (ITP). Today the server rewrites the 400-day auth cookies when it refreshes the session during a page load. If the service worker serves page loads from its cache, that may stop happening, and the iPhone app could sign the traveller out after a week without opening it.
