# 08: Bookings

**What to build:** The traveller declares the train they booked for a leg. They can pick it from the candidates, or from every train of that day on the leg's routes, including trains that currently show no seat. The booking appears on the home screen and the leg view, ranked against the candidates. A counter shows how many trips are held against the MAX JEUNE limit of 6. See user stories 41–46 in the spec.

**Blocked by:** 06 (Leg detail)

**Status:** ready-for-agent

- [x] « J'ai réservé » is available on every candidate of the leg view.
- [x] « Déclarer une réservation » lists every train of the leg's date on its routes from the latest observations, open or not.
- [x] A leg has at most one booking. Declaring a new one replaces it, and the booking can be cancelled.
- [x] The home card shows « Réservé » with the booked train. The leg view shows the booking and highlights the candidates ranking strictly above it.
- [x] The domain core ranks the booking with the same rules as candidates. A booking whose route is no longer in the leg ranks below every candidate.
- [x] The home screen shows the active bookings count as « x/6 ».
- [x] Bookings are owned by the traveller and protected by RLS.
- [x] Vitest (seam 1): booking comparison, e.g. route 2 booked at 7:10 vs route 1 appearing at 6:05; a booking on a removed route.
- [x] Playwright: declare from a candidate, declare from the full list, replace, cancel.
