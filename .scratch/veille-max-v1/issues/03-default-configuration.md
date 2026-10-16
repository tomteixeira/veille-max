# 03: Default configuration (trip template)

**What to build:** The traveller describes their trip template once: for each leg, its weekday, time window, ideal time and ranked routes, picked from stations shown by their full names. It is stored per traveller and protected by RLS (ADR 0002).

**Blocked by:** 02 (Sign in with an email code)

**Status:** ready-for-human

- [x] A station reference covers the station codes present in the `tgvmax` dataset, built from `trainline-eu/stations` (`sncf_id`), with a hand-written override for the 10 city-level codes (Paris, Lyon, Lille stations). The refresh script is documented.
- [x] Réglages shows the trip template as « Votre week-end type », drawn as the home ticket ("Billet modèle", see the spec's UI module). Each half shows the weekday, « Arriver avant » or « Partir après » with the time, a one-day bar (accepted zone plus a dot at the ideal time, with a caption in words) and the ranked route chips.
- [x] Tapping a half opens a bottom-sheet editor: weekday chips (Friday / Sunday by default), Partir/Arriver (anchor) and avant/après (bound) segments with the time, the ideal time, the same day bar updating live, and the ranked routes. The UI exposes one bound per leg; the domain still accepts both bounds.
- [x] Each leg holds a ranked list of routes. Routes are added with « + Ajouter une route » and a searchable origin and destination station picker, reordered with up and down buttons, and removed. The same route cannot appear twice in a leg.
- [x] A new traveller starts with Friday outbound, Sunday return and no routes.
- [x] Template data carries the traveller's `user_id`, and RLS prevents any traveller from reading or writing another's template (covered by a test).
- [x] Playwright: configure two routes per leg with windows and ideal times, reorder them, reload, and find everything persisted.

## Comments

- 2026-10-16 — Local work done on `feat/03-default-configuration`. Lint, typecheck, Vitest (unit and integration) and Playwright pass. Status `ready-for-human`: review and merge the pull request. Merging applies the two new migrations to the hosted project; nothing else is manual. Decisions made while implementing:
  - **Station reference.** `npm run stations:refresh` (`scripts/refresh-stations.mjs`) reads the codes in `tgvmax` (322 on 2026-10-16) and writes a migration that upserts `public.stations`. It never deletes a station, since a route may still use it. Names: trainline-eu/stations for 317 codes, hand-written for the 10 city-level codes (« Paris Bercy » rather than trainline's « Paris Bercy Bourgogne-Pays d’Auvergne », « Lille Europe », « Lille Flandres »…), and the dataset's own name, title-cased, for the 5 Meuse coach stops trainline lacks. Documented in the README, "Station reference".
  - **Default windows.** The ticket only fixes the weekdays and the empty routes. The windows come from CONTEXT.md's examples: Aller « Arriver avant 10:00 », ideal 09:00; Retour « Partir après 14:00 », ideal 17:00. Change them in `defaultTripTemplate()` if wrong.
  - **Defaults live in the domain, not in rows.** A traveller without a `template_legs` row for a leg gets the default leg (`shared/domain/trip-template.ts`). The first « OK » writes the row. There is no trigger on `auth.users` and no backfill for existing travellers.
  - **Saving.** The editor works on a draft. « OK » saves the leg and its ranked routes in one transaction through `save_template_leg` (security invoker, so RLS applies). « Annuler », Escape and a tap on the dimmed page drop the draft. The tables also accept direct writes under RLS, as the spec's "Settings writes" says.
  - **One bound in the UI.** « avant » writes the window's end and « après » its start, clearing the other bound. A window with both bounds (possible in the domain and the database only) shows « Arriver entre 07:00 – 10:00 » on the ticket. The editor opens it on the bound that matches its anchor and keeps both bounds unless the traveller changes the bound or its time.
  - **Storage types.** Weekdays are ISO (1 = Monday). Times are Postgres `time`, read as « HH:MM ». The day bar spans 05:00 to midnight.
  - **Station picker.** It ignores case and accents, matches each typed word against the start of a word of the name, and treats « saint » as « st » (« saint exupery » finds « Lyon St-Exupéry TGV »). Results are listed under the field, not in a popover.
  - **Tests.** Seam 1: `test/unit/trip-template.test.ts` (defaults, adding, refusing duplicates and same-station routes, moving, removing). Seam 2 is new: a Vitest `integration` project against the local stack (`npm run test:integration`), run in CI's end-to-end job, with travellers created and deleted per run. It covers storage round trips and RLS: reading, writing in another traveller's name, updating or deleting another traveller's rows, signed-out access. The RLS tests were checked to fail with RLS turned off. `npm test` runs both projects, so CLAUDE.md's check before finishing covers RLS; it now needs the local stack. CI's checks job runs `npm run test:unit`. Seam 3: `test/e2e/trip-template.spec.ts` runs the journey with a throwaway invited traveller, so the seeded one stays untouched.
  - **Pre-existing flaky test, not fixed here.** `auth.setup.ts` and the sign-in journey of `sign-in.spec.ts` both request a code for the seeded traveller. When the two requests land less than a second apart, Supabase refuses the second (`over_email_send_rate_limit`) and the journey fails. It happened once in four local full runs; CI retries once.
