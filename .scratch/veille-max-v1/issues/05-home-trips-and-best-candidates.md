# 05: Home: trips and best candidates

**What to build:** The home screen lists every trip of the next 30 days, generated from the trip template. For each leg it shows the best candidate according to the ranking, computed by the domain core from the latest snapshot. This slice creates the domain core (seam 1) and its single evaluation entry point. See "Domain core" and "Ranking rules" in the spec.

**Blocked by:** 04 (Daily snapshot ingestion)

**Status:** ready-for-agent

- [x] The domain core is a pure module (no I/O, no framework imports) with one evaluation entry point. Input: the current instant, the traveller's settings, the latest observations. Output: the trips with their legs and ranked candidates.
- [x] Trips are generated across the tracking horizon from the template weekdays. A trip is identified by the ISO year-week of its default outbound date.
- [x] A candidate is an observation with an open seat in the latest snapshot, on one of the leg's routes, on the leg's date.
- [x] Ranking puts in-window candidates first (by route rank, then distance to the ideal time, then earlier departure), then out-of-window candidates (by minutes outside the window + route weight × (rank − 1), then route rank, then earlier departure). The route weight defaults to 30.
- [x] An arrival time earlier than the departure time is treated as the next day.
- [x] An authenticated evaluation endpoint returns the home view for the signed-in traveller.
- [x] The home screen shows the trips as ticket cards in a horizontal snap carousel ("Billets" direction, see the spec's UI module). Each card has an Aller half and a Retour half separated by a perforation. Each half shows its status chip and the best candidate (big departure and arrival times, route, duration), or « Aucun train ».
- [x] Vitest (seam 1, test-first) covers horizon generation including the DST change, departure and arrival anchors, open-ended windows, in-window ordering, the out-of-window weighting (route 1 at 11:00 vs route 3 at 10:25 with weight 30, then 10) and arrival after midnight.
- [x] Playwright: with a seeded snapshot fixture, the home screen shows the expected best candidates.
