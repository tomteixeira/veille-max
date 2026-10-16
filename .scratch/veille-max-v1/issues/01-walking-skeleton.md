# 01: Walking skeleton

**What to build:** A deployed, empty Veille MAX app that already looks like the product: French UI, app shell, light and dark themes. It comes with a local Supabase stack and a CI pipeline that runs every kind of test, so every later slice lands on green rails. See the spec's "Stack and hosting" and "CI/CD" sections.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Nuxt 4, Vue 3, TypeScript in strict mode and Tailwind are set up; the UI copy is in French.
- [ ] An app shell with navigation to Accueil, Dashboard and Réglages (placeholder pages), mobile-first.
- [ ] Light and dark themes follow the system preference and implement the "Billets" visual direction chosen in the UI prototype (see the spec's UI module): Plus Jakarta Sans, warm stone neutrals, orange as the single accent, large radii, a floating pill tab bar. No SNCF logo, colours or brand elements.
- [ ] A visible mention that the app is not affiliated with SNCF.
- [ ] A local Supabase stack runs through the Supabase CLI, schema changes are versioned migrations, and an initial migration applies cleanly.
- [ ] Vitest runs with one sample test, and Playwright runs one smoke test that loads the app against the local stack.
- [ ] GitHub Actions on every pull request runs lint, typecheck, Vitest and Playwright (with the local Supabase stack), all green.
- [ ] Merging to `main` applies migrations to the hosted Supabase project, and Vercel deploys the app through its Git integration with the `vercel` preset.
- [ ] The README explains how to run the app, run the tests and deploy, and lists the required environment variables by name.

## Comments

- 2026-10-16 — UI prototype. Question: what should Veille MAX look like? Three variants were compared (A « Liste clinique », B « Billets », C « Agenda »). **Verdict: B**, because it looks modern and makes the situation clear at a glance. A « Nouveautés » section was added between the trip carousel and « Bientôt ouverts ». The primary source is `.scratch/veille-max-v1/prototype-ui/index.html` (run with the `prototype-ui` entry of `.claude/launch.json`). When the repo is initialised, commit the prototype to a throwaway branch `prototype/ui-variants` and keep it out of `main`. Rewrite the chosen design properly; don't copy the prototype code.
- 2026-10-16 — UI prototype, round 2. Question: in the "Billets" style, what should the Dashboard and Réglages look like, and do we keep a time-axis ("frise") view? The time-axis leg views of A and C were judged hard to read, so the leg detail stays tickets only (ticket 06). **Verdict: Dashboard D1 « Histoires »** (one card per question, titled with its conclusion) and **Réglages R3 « Billet modèle »** (the trip template drawn as the home ticket, with editing in a bottom sheet). The only "frise" kept is the one-day bar in Réglages showing the accepted zone and the ideal time. The other variants (D2 « Onglets », D3 « Par trajet », R1 « Liste », R2 « Hub ») stay in the prototype file as the primary source.
