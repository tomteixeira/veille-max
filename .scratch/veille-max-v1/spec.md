# Veille MAX v1

Status: ready-for-agent

Vocabulary follows `CONTEXT.md`. Decisions follow `docs/adr/0001` (daily open-data snapshot), `0002` (multi-user schema, shared availability) and `0003` (pg_cron tick). Facts about the data source, SNCF links and iOS constraints are in `docs/research/tgvmax-data-source.md`.

## Problem Statement

I hold a MAX JEUNE subscription and go back to my parents' almost every weekend: out on Friday, back on Sunday. MAX JEUNE seats are limited per train, released gradually between D-30 and D-2, and often missing on busy weekend trains. Several station pairs work for me in each direction, with clear preferences between them and between times of day. Today I have to search SNCF Connect by hand, pair by pair and weekend by weekend, again and again, to find out whether a seat came out. Once I have booked a train, I keep searching in case something better appears. I regularly miss good trains or lose time, and I sometimes forget to confirm a booking the day before, which cancels it.

## Solution

Veille MAX is a mobile-first web app installed on my iPhone home screen. I describe once my default trip: for each leg, the ranked routes I accept, a preferred time window and an ideal time. The app generates every trip in the next 30 days from that template, lets me customise or mute any of them, and reads the SNCF open-data snapshot every morning. For each leg it ranks every train with an open MAX JEUNE seat on my routes. It pushes a notification as soon as the best candidate of a leg improves, or once I have declared a booking, only when something strictly better than my booking appears. It shows all routes of a leg at a glance, links to a pre-filled SNCF Connect search, and reminds me at noon the day before each booked leg to confirm it. A dashboard shows when seats come out on my routes, so I can understand the release pattern.

## User Stories

### Access and onboarding

1. As an invited traveller, I want to sign in with a 6-digit code sent by email, so that I can log in from inside the installed app without being sent to Safari.
2. As an invited traveller, I want to sign in with Google, so that I can log in in one tap.
3. As a stranger, I want to be refused when I try to sign up, so that the app stays private while it is not open to the public.
4. As a traveller, I want my session to last a long time, so that I don't have to sign in again every time I open the app.
5. As a new traveller, I want a 3-step onboarding (default configuration, install on home screen, enable notifications), so that I end up with a working setup without guessing.
6. As a new traveller on iPhone, I want illustrated instructions for "Share → Add to Home Screen", so that I can install the app, which iOS requires before it can send notifications.
7. As a traveller who skipped an onboarding step, I want a banner reminding me what is missing, so that I don't wonder why I receive no notifications.
8. As a traveller, I want to sign out and see which account I'm signed in with, so that I stay in control of my account.

### Trip template

9. As a traveller, I want to set the weekday of my outbound leg (Friday by default) and of my return leg (Sunday by default), so that trips are generated on the right days.
10. As a traveller, I want to add routes to each leg by picking an origin station and a destination station with a searchable station picker that shows full station names, so that I don't have to know SNCF station codes.
11. As a traveller, I want to reorder the routes of a leg, so that rank 1 is the one I prefer.
12. As a traveller, I want to remove a route from a leg, so that I stop being offered trains I no longer accept.
13. As a traveller, I want to choose whether a leg's time window applies to departure or to arrival, so that I can say "arrive before 10:00" on Friday and "depart after 14:00" on Sunday.
14. As a traveller, I want to set an optional lower and an optional upper bound for the time window, so that I can express open-ended windows.
15. As a traveller, I want to set an ideal time on the same anchor as the window, so that the train closest to it wins between equally good routes.
16. As a traveller, I want template changes to apply to every trip I have not customised, so that I only maintain one configuration.

### Trips

17. As a traveller, I want to see every trip of the next 30 days on the home screen, so that I know at a glance where I stand for each weekend.
18. As a traveller, I want each trip card to show, per leg, the booking or the best candidate and a status ("Réservé", "Amélioration", "Rien pour l'instant", "En sourdine"), so that I know which legs need attention.
19. As a traveller, I want the next two weekends beyond the horizon to appear as upcoming trips with their opening date, so that I can prepare them in advance.
20. As a traveller, I want to customise an upcoming trip, so that a weekend I already know is special is set up before bookings open.
21. As a traveller, I want an upcoming trip to become tracked automatically when it enters the horizon, so that I don't have to do anything.
22. As a traveller, I want to change the date of either leg of a specific trip (e.g. Thursday evening or Monday), so that long weekends and exceptions are tracked correctly.
23. As a traveller, I want to add or remove routes for a specific trip, so that I can track a different destination one weekend.
24. As a traveller, I want to change the time window and ideal time of a specific trip, so that I can adapt to that weekend's constraints.
25. As a traveller, I want a customised trip to be clearly marked and to have a "Réinitialiser" action, so that I can go back to the template.
26. As a traveller, I want to mute a whole trip, so that I still see its trains but receive no notification for a weekend I don't plan to travel.
27. As a traveller, I want to mute a single leg, so that a leg already handled another way (e.g. driving back with my parents) stops notifying me.
28. As a traveller, I want to unmute a trip or leg at any time, so that I can decide to travel at the last minute.
29. As a traveller, I want unmuting not to flood me with notifications about trains I could already see, so that notifications stay meaningful.
30. As a traveller, I want past trips to be archived rather than deleted, so that their bookings feed the dashboard.

### Leg detail and ranking

31. As a traveller, I want a leg view listing every candidate of every route as a ticket, in ranking order, with filters per route, so that I can compare everything quickly.
32. As a traveller, I want the time window and the ideal time shown on the leg view, so that I see immediately which trains fit.
33. As a traveller, I want the best candidate highlighted, so that I know what the app recommends.
34. As a traveller, I want trains outside the window to still be listed, ranked after those inside it, so that I can decide to adapt my day rather than have no train at all.
35. As a traveller, I want out-of-window trains ranked by how far they are from the window plus a penalty per route rank, so that a slightly later train from a better station can win.
36. As a traveller, I want to set how many minutes one route rank is worth (route weight, default 30) in my settings, so that the ranking matches my own trade-off.
37. As a traveller, I want a short explanation of why a candidate ranks where it does (in window or not, route rank, gap to ideal time), so that I trust the ranking.
38. As a traveller, I want to see when the displayed availability was last updated (snapshot time), so that I know how fresh it is.
39. As a traveller, I want a "Réserver" link on each candidate that opens a pre-filled SNCF Connect search for that route, date and time, so that I can book in a few taps.
40. As a traveller, I want a "Vérifier en direct" link at the top of a leg that opens SNCF Connect at the start of the window, so that I can check intra-day releases by hand.

### Bookings

41. As a traveller, I want to declare "J'ai réservé" directly on a candidate, so that the app knows what I hold.
42. As a traveller, I want to declare a booking by picking from every train of the leg's date on its routes, including trains currently showing no seat, so that I can declare the train whose last seat I just took.
43. As a traveller, I want declaring a new booking on a leg to replace the previous one, so that switching to a better train is one action.
44. As a traveller, I want to cancel a declared booking, so that the leg goes back to normal tracking.
45. As a traveller, I want my booked train shown on the leg view alongside better candidates, so that I can decide whether to switch.
46. As a traveller, I want to see how many trips I currently hold out of the MAX JEUNE limit of 6, so that I don't hit the limit by surprise on SNCF Connect.

### Notifications

47. As a traveller, I want a push notification when a leg's best candidate improves, so that I can book before the seat is gone.
48. As a traveller, I want a notification when the first candidate appears on a leg that had none, so that I know a weekend is now possible.
49. As a traveller with a booking, I want to be notified only of candidates strictly better than my booking, so that I'm not disturbed by trains worse than what I hold.
50. As a traveller, I want no notification when a candidate that isn't the new best appears, or when a candidate disappears, so that every notification calls for an action.
51. As a traveller, I want one notification per improved leg, sent right after the morning snapshot, so that I can act as soon as I wake up.
52. As a traveller, I want tapping a notification to open the app on that leg, so that I see the context (other routes, my booking) before going to SNCF Connect.
53. As a traveller, I want no availability notification for a muted trip or leg, so that muting really silences it.
54. As a traveller, I want a Confirmation Reminder at noon the day before each booked leg, so that I don't lose the booking at SNCF's 17:00 deadline.
55. As a traveller, I want tapping the reminder to open a "Trajets à confirmer" screen with a button that opens the MAX JEUNE confirmation page in Safari, so that I confirm in 30 seconds with my Safari session.
56. As a traveller, I want notifications on every device where I enabled them, so that I get them on my phone and my laptop.
56b. As a traveller, I want to turn Confirmation Reminders off in Réglages, so that I'm not reminded if I confirm my trips another way.
57. As a traveller, I want to enable, disable and test notifications for the current device in settings, so that I can check that everything works.
58. As a traveller, I want never to receive the same notification twice for the same snapshot, so that a retried job doesn't spam me.

### Dashboard

59. As a traveller, I want a release curve showing when openings start on my routes (days before departure), so that I can verify the J-29 / J-11 / J-3 waves.
60. As a traveller, I want availability by weekday and train departure-hour band, so that I see which slots are most likely to have seats.
61. As a traveller, I want the distribution of opening lifetimes (how many snapshots a seat stays open), so that I know how quickly I must react.
62. As a traveller, I want each leg's day-by-day history (number of candidates, best candidate over time), so that I can see how a given weekend evolved.
63. As a traveller, I want the dashboard filtered by default on my trip weekdays (Friday and Sunday), with a switch to all days, so that it focuses on what matters to me.
64. As a traveller, I want my current bookings count on the dashboard, so that I know where I stand against the limit of 6.

### Look and feel

65. As a traveller, I want a clean, modern, mobile-first interface in light and dark modes, so that it feels like a polished product.
66. As a traveller, I want the interface in French, so that it reads naturally.
67. As a traveller, I want the app to make clear it is not an SNCF product, so that nobody confuses it with an official service.

## Implementation Decisions

### Stack and hosting

- Nuxt 4, Vue 3, TypeScript (strict), Tailwind. The backend is Nuxt's Nitro server running on Node, deployed to Vercel Hobby with the `vercel` preset.
- Supabase hosts Postgres, Auth, Vault, `pg_cron` and `pg_net`. Schema changes are versioned migrations in the repo, managed with the Supabase CLI, applied by CI on merge to `main`.
- PWA via `@vite-pwa/nuxt` with `strategies: 'injectManifest'` (custom service worker for push handling), `display: standalone`, an explicit manifest `scope`. Check the known Nuxt 4 manifest-404 bug against the `vercel` preset early.
- All times are handled in Europe/Paris. Snapshot times are local "HH:MM" strings; an arrival earlier than the departure means the next day.

### Modules

1. **Domain core** (pure TypeScript, no I/O, no framework imports). This is the main testing seam. One entry point evaluates a traveller's situation. It is the only place where business rules live.
   - Input: the current instant; the traveller's settings (trip template, trip customisations, mutes, bookings, route weight); the train observations for the traveller's routes in the latest snapshot; the stored reference best candidate of each leg from the previous evaluation.
   - Output: tracked trips and upcoming trips, each with its two legs; per leg: effective settings (template or customised), ranked candidates with an explanation (in window or not, route rank, minutes from window, minutes from ideal time), best candidate, booking and its rank, status, and the new reference; the list of improvements to notify (leg, candidate, kind: first candidate / new best / better than booking); the Confirmation Reminders due; the count of active bookings.
   - Sub-parts it should expose to tests through the single entry point (not as separate public modules): trip generation from the template over the tracking horizon, plus two upcoming trips; application of customisations; candidate selection; ranking; improvement detection; reminder scheduling.
   - Also hosts the SNCF Connect search link builder (from route codes and a local date-time) and the MAX JEUNE confirmation link (`https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages`, opened through `x-safari-https://` with a plain https fallback).
2. **Snapshot ingestion** (Nitro server). Behind a `SnapshotSource` port with two operations: read the dataset's last-processed timestamp, and export the rows for a set of routes over a date range. The real adapter calls the Opendatasoft Explore API v2.1 `tgvmax` metadata and filtered `exports/json` endpoints (no API key). It does not use `/records` paging. It deduplicates rows on (date, train number, origin code, destination code), and a duplicate counts as open if any copy says OUI.
3. **Notification delivery** (Nitro server). Behind a `PushGateway` port: send a payload to a push subscription and report whether the subscription is gone (404/410 → delete it). The real adapter uses Web Push with VAPID keys from environment variables.
4. **Tick endpoint**: a single POST endpoint, protected by a shared secret header (secret stored in Supabase Vault for the caller, environment variable on Vercel). `pg_cron` calls it every 15 minutes through `pg_net` with a raised timeout. On each call:
   - read the snapshot timestamp; if it differs from the last ingested snapshot, ingest it (the union of every route in every traveller's template and customised trips, all dates from today to D+30), update observations and openings, then evaluate every traveller, persist the new references, and send improvement notifications;
   - when the Paris local time has passed noon, send the Confirmation Reminders due today that have not been sent yet;
   - return a summary (whether it ingested, snapshot id, notifications sent, reminders sent). It must be idempotent: running it twice for the same snapshot or the same reminder sends nothing new.
5. **Evaluation read API** (Nitro): authenticated endpoints that load the caller's settings and the latest observations, run the domain core, and return the home view (trips), a leg view, the bookable trains of a leg (all trains of that date on its routes, open or not), the confirmation list and the dashboard aggregates.
6. **Settings writes**: the client reads and writes traveller-owned settings directly through Supabase with RLS (template legs and routes, customisations, mutes, bookings, route weight, onboarding state). After a write that changes a leg's ranking, the leg's reference is reset to its current best candidate without notifying: the traveller is looking at the app at that moment. Improvements are only detected at snapshot ingestion.
7. **Station reference**: a seeded table of station codes (the 5-character SNCF codes used by the dataset) with full names, built from `trainline-eu/stations` (ODbL, `sncf_id` column) for the codes present in `tgvmax`, with a hand-written override for the 10 city-level Paris/Lyon/Lille codes. It is refreshed by a manual script, not at runtime.
8. **UI** (Nuxt pages, French): Home (trips), Leg detail, Default configuration, Dashboard, Settings, plus Sign-in, Onboarding and "Trajets à confirmer". Mobile-first, light and dark themes. No SNCF logo, colours or brand elements. The chart library is the implementer's choice, as long as it renders client-side without breaking SSR and supports both themes.
   - **Visual direction: "Billets"** (variant B of the UI prototype, chosen by the user 2026-10-16; prototype in `.scratch/veille-max-v1/prototype-ui/`). Plus Jakarta Sans, heavy weights for times. Warm stone neutrals, with orange as the single accent and emerald for "Réservé". Large radii (cards ~28 px, buttons ~16 px), soft shadows. A floating pill tab bar.
   - **Home, top to bottom**:
     - a date line and a headline that counts this morning's improvements (« 3 nouveaux trains ce matin. »), with chips for « x/6 réservés » and the snapshot time;
     - a horizontal snap carousel with one ticket card per tracked trip. Each card shows the Aller and Retour halves separated by a perforation; each half has its leg status chip, big departure/arrival times and the route;
     - « Nouveautés », a compact list of today's improvements (leg, times, route, chip) opening the leg;
     - « Bientôt ouverts », the upcoming trips with their opening date and a « Préparer » action.
   - **Leg detail**: the leg and date, a headline with the candidate count, and a window banner (« Arrivée avant 10:00 · idéale 09:00 »). The booking appears as a green "Votre billet" card. Route filter chips (« Tous » + one per route) sit above a vertical stack of ticket cards, one per candidate: route rank, ranking explanation, departure/arrival with full station names, duration, train number, « J'ai réservé » and « Réserver ↗ ». The best candidate gets an orange ring and a « Meilleur choix » band. A « Vérifier en direct sur SNCF Connect » button closes the list.
   - **Dashboard: "Histoires"** (variant D1 of the prototype, chosen 2026-10-16). The header shows « Vos routes · depuis <first snapshot> », with filter chips « Vendredi & dimanche » (default, the template weekdays) and « Tous les jours ». Cards follow, top to bottom:
     - a bookings card: hero « x/6 », six dots and the average booking day (« Vous réservez en moyenne à J-9 »);
     - then one card per question, titled with its one-sentence conclusion, chart underneath:
       - release curve: one column per D-n, with the three wave peaks emphasised in orange and labelled;
       - slots heatmap: weekday × departure-hour band, a single orange sequential ramp, values in the cells;
       - Opening lifetimes: horizontal bars;
       - leg history: leg chips plus one column per snapshot.
     Tapping a column shows its value. Charts follow the dataviz rules: thin marks, 4 px rounded data ends, 2 px gaps, recessive axes, text never in the series colour.
   - **Réglages: "Billet modèle"** (variant R3, chosen 2026-10-16). « Votre week-end type » draws the trip template as the home ticket. Each half shows:
     - the weekday;
     - « Arriver avant » or « Partir après » with the time in large type;
     - a one-day bar (the only "frise" kept): accepted zone plus an orange dot at the ideal time, captioned in words;
     - the ranked route chips.
     Tapping a half opens a bottom-sheet editor: weekday chips; Partir/Arriver and avant/après segments with the time; ideal time; the same day bar; ranked routes with up, down and remove; « + Ajouter une route ». Below the ticket come four cards:
     - « Pondération des gares »: a slider with a live worked example of which route wins;
     - Notifications: this-device toggle, « Rappel de confirmation » toggle, device list, test notification;
     - Compte et application;
     - the non-affiliation note.

### Data model (prose)

- **Global, no owner** (readable by authenticated users, written only by the server role):
  - stations;
  - snapshots (SNCF processed timestamp, ingestion time, row counts);
  - train observations (date, train number, origin code, destination code, departure and arrival times, first and last snapshot seen);
  - openings (the train observation they belong to, first open snapshot, last open snapshot, whether still open).
- **Traveller-owned**, each row carrying `user_id` with RLS restricting it to its owner (ADR 0002):
  - traveller settings (route weight, onboarding progress);
  - template legs (kind outbound/return, weekday, anchor departure/arrival, optional window bounds, ideal time) and their ranked routes;
  - trip customisations keyed by trip and leg (date, anchor, window, ideal time, custom ranked routes);
  - mutes (trip-level and leg-level);
  - bookings (trip, leg, train observation);
  - leg references (the stored best candidate per trip and leg, and the snapshot it came from);
  - push subscriptions (endpoint, keys, device label);
  - notification log (kind, trip, leg, candidate, snapshot or reminder date, sent time), used for idempotency.
- A trip is identified by the ISO year-week of its default outbound date. That key does not change when its dates are customised.

### Ranking rules (domain core)

- A candidate is a train observation with an open seat in the latest snapshot, on one of the leg's effective routes, on the leg's effective date.
- The anchor time is the departure or arrival time, depending on the leg's anchor. A candidate is in the window when its anchor time satisfies every bound that is set.
- In-window candidates come first, ordered by route rank, then by absolute distance to the ideal time, then by earlier departure.
- Out-of-window candidates follow, ordered by cost = minutes outside the window + route weight × (route rank − 1), then by route rank, then by earlier departure.
- A booking is ranked with the same rules, as if it were a candidate. A booking whose route is no longer among the leg's routes ranks below every candidate.
- Improvement: the leg's new best candidate ranks strictly above its reference. The reference is the better of the previous reference best candidate and the booking. A leg with no previous reference and no booking that now has a candidate counts as a first-candidate improvement. Muted trips and legs still update their reference but never produce improvements to send.
- A leg is tracked until the end of its effective date; a trip is archived once both legs' dates have passed.

### Notifications

- One notification per improvement, in French, with route, date, times and kind. Its click target is the in-scope leg view.
- Confirmation Reminders are sent at noon Paris time the day before each booked leg, regardless of mute. Their click target is the in-scope "Trajets à confirmer" screen.
- The service worker's click handler only opens in-scope URLs. External links (SNCF Connect, MAX JEUNE) are opened from in-app buttons.
- The permission prompt and the subscription call happen inside a user gesture (iOS requirement). Every push shows a visible notification.

### Auth

- Supabase Auth with email OTP (6-digit code typed in the app; no magic links) and Google OAuth via a full-page PKCE redirect whose callback is inside the PWA scope. No Apple sign-in.
- Public sign-ups are disabled: travellers are invited from the Supabase dashboard, and OTP requests do not create users.

### CI/CD

- GitHub Actions on every pull request: lint, typecheck, Vitest, then Playwright against a local Supabase started with the CLI (Docker), seeded with fixture data.
- Merging to `main` applies Supabase migrations and Vercel deploys through its Git integration.
- Deploy the ingestion as early as possible: dashboard history only exists from the first ingested snapshot.

## Testing Decisions

- Good tests exercise external behaviour through a seam and assert on observable outputs (rankings, improvements, sent notifications, stored rows, rendered screens), never on internal helpers or call order. Scenarios use the glossary's vocabulary and the concrete cases from the design discussion.
- **Seam 1, domain core (Vitest, written test-first)**: the bulk of the tests, all through the single evaluation entry point with hand-built settings and observations. Cases to cover at least:
  - trip generation across the horizon, upcoming trips and DST;
  - customisation copy-on-write and reset;
  - window anchors and open-ended bounds;
  - in-window ordering;
  - out-of-window weighted cost (route 1 at 11:00 vs route 3 at 10:25 with weight 30 and 10);
  - booking comparison (booked 7:10, 6:05 appears);
  - first-candidate improvement, no notification on disappearance, reappearance;
  - mute behaviour and unmuting without a flood;
  - duplicate OUI/NON rows;
  - arrival after midnight;
  - reminder scheduling and the active-bookings count;
  - SNCF Connect link format.
- **Seam 2, tick endpoint (integration, Vitest against local Supabase)**: `SnapshotSource` fed with a frozen snapshot fixture, `PushGateway` replaced by a recording fake, clock injected. Verify:
  - ingestion happens once per processed timestamp;
  - observations and openings are created and closed across two successive fixture snapshots;
  - improvements reach every subscription of the right traveller and none for muted legs;
  - gone subscriptions are deleted;
  - reminders fire once after noon Paris;
  - the endpoint rejects calls without the secret;
  - RLS prevents one traveller from reading another's rows.
- **Seam 3, end-to-end (Playwright, local Supabase, seeded fixture)**:
  - sign in with an OTP read from the local mail catcher;
  - onboarding;
  - editing the default configuration;
  - customising, resetting and muting a trip;
  - declaring and cancelling a booking;
  - reading the leg view and the dashboard;
  - the "Trajets à confirmer" screen.
  Real push delivery and iOS home-screen installation are not automatable and go to a manual device checklist.
- No prior art exists: the repo is empty. These tests set the conventions.

## Out of Scope

- Any real-time or unofficial availability source (MAX JEUNE / SNCF Connect internal APIs); possible v2 (ADR 0001).
- Automatic booking, cancellation or confirmation on SNCF systems.
- Sign in with Apple.
- Payments or subscriptions.
- MAX SENIOR, MAX Actif, OUIGO, connections and multi-leg journeys.
- Network-wide analytics: only the travellers' routes are collected.
- Digest notifications, quiet hours, a minimum improvement threshold, and a "cancel your current booking first" warning.
- Languages other than French in the UI; native apps.

## Further Notes

- **Verify on a real iPhone with the first prototype:**
  - Google OAuth inside the installed PWA (redirect returning to the standalone window);
  - the `x-safari-https://` button opening the MAX JEUNE confirmation page in Safari;
  - notification click opening the right in-scope screen.
- Unverified data facts:
  - whether the snapshot time moves to 05:24 UTC after the 2026-10-25 DST change (the tick design does not depend on it);
  - whether OUIGO MAX seats appear in the dataset at all.
- The SNCF Connect deep link format is undocumented and may break. Keep the link builder isolated and covered by a test that pins the format.
- MAX JEUNE rules worth surfacing in the UI copy:
  - at most 6 trips held at once;
  - confirmation before 17:00 the day before;
  - bookings open at D-30, effectively visible in the dataset from D-29.
- Decided while writing this spec, not discussed explicitly (revisit if wrong):
  - trip key = ISO week of the default outbound date;
  - a settings change silently resets the leg reference;
  - Confirmation Reminders ignore mutes;
  - a leg is tracked until the end of its date;
  - a booking whose route was removed ranks below every candidate;
  - settings are written from the client through RLS while evaluations come from Nitro.
