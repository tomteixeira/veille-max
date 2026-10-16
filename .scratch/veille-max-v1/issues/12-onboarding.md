# 12: Onboarding

**What to build:** A new traveller is guided through three steps after their first sign-in: create the default configuration, install the app on the home screen, enable notifications. A banner reminds them of any missing step. See user stories 5–7 in the spec.

**Blocked by:** 03 (Default configuration), 09 (Installable PWA and push devices)

**Status:** ready-for-agent

- [ ] After the first sign-in, the traveller enters a 3-step flow. Step 1 reuses the default configuration editor. Step 2 has illustrated iOS instructions (« Partager → Sur l'écran d'accueil ») and is marked done when the app runs in standalone mode. Step 3 enables notifications.
- [ ] Steps can be skipped. Progress is persisted per traveller.
- [ ] While a step is incomplete, the home screen shows a banner naming the missing step, with a link back to it.
- [ ] Playwright: a new invited traveller goes through the flow; the banner disappears once every step is done (standalone mode and permission mocked).

## Comments

- 2026-10-16 — From ticket 02: the Réglages « Compte et application » card has an « Application » row that shows « Bientôt ». Fill it with the installation state from step 2 (« Installée sur l’écran d’accueil », as in the prototype R3).
