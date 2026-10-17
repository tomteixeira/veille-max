# 11: Confirmation reminders

**What to build:** At noon Paris time the day before each booked leg, the traveller receives a Confirmation Reminder. Tapping it opens « Trajets à confirmer », which lists tomorrow's bookings with a button that opens the MAX JEUNE confirmation page in Safari, where they are logged in. See "Confirmation Reminder" in `CONTEXT.md` and the MAX JEUNE confirmation page in the research note.

**Blocked by:** 08 (Bookings), 09 (Installable PWA and push devices)

**Status:** ready-for-agent

- [x] From noon Paris time on the day before a booked leg, the tick sends one reminder per booking, mutes or not. A booking cancelled before then gets none.
- [x] The Notifications card in Réglages has a « Rappel de confirmation » toggle, on by default. When it is off, no reminder is sent.
- [x] Reminders are idempotent: a re-run never sends a second one.
- [x] The reminder copy mentions SNCF's 17:00 deadline. Its click target is the in-scope « Trajets à confirmer » screen.
- [x] « Trajets à confirmer » lists the legs booked for tomorrow. « Confirmer sur MAX JEUNE » opens `https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages` through `x-safari-https://`, with a plain https fallback.
- [x] Vitest (seam 1): reminder scheduling, including around the DST change.
- [x] Integration (seam 2, injected clock): a tick at 11:59 sends nothing, a tick at 12:05 sends one reminder, a later tick sends nothing more.
- [x] Playwright: the screen lists a seeded booking with the button.
- [ ] Manual iPhone check: the button opens Safari on the confirmation page while logged in. If `x-safari-https://` does not work from the PWA, document it and keep the fallback.
