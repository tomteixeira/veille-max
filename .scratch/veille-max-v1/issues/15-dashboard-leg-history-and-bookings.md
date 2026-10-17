# 15: Dashboard: leg history and bookings

**What to build:** On the dashboard, the traveller can replay how any leg evolved day by day, including legs of archived trips: number of candidates and best candidate per snapshot. They also see where they stand with bookings: current count against the limit of 6, and how many days before departure they usually book. See user stories 62 and 64 in the spec.

**Blocked by:** 08 (Bookings), 14 (Dashboard: when seats come out)

**Status:** ready-for-agent

- [x] A « Historique d'un trajet » card (in the "Histoires" layout) lets the traveller pick a trip leg (tracked or archived) with leg chips. It shows one column per snapshot (number of candidates) and gives the best candidate on tap, all under the leg's settings.
- [x] The first dashboard card shows the current active bookings count as a hero « x/6 », six dots and the average booking day (« Vous réservez en moyenne à J-9 »).
- [x] Past bookings show how many days before departure they were declared.
- [x] The history is derived from stored observations and Openings, with no extra collection.
- [x] Integration (seam 2): the leg history is correct for a known fixture sequence.
- [x] Playwright: pick a leg and see its history; the bookings counter matches the seeded bookings.
