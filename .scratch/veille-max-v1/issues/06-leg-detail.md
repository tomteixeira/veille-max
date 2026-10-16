# 06: Leg detail: every candidate as a ticket

**What to build:** Tapping a leg opens the "Billets" leg view (see the spec's UI module): a window banner, the booking if any, route filter chips, and one ticket card per candidate in ranking order. Each ticket explains its rank and links to a pre-filled SNCF Connect search. The traveller can tune the route weight. See user stories 31–40 in the spec. A time-axis view was prototyped and rejected as hard to read.

**Blocked by:** 05 (Home: trips and best candidates)

**Status:** ready-for-agent

- [x] The leg view shows the leg and date, a headline with the candidate count, and a banner with the time window and ideal time.
- [x] Route filter chips (« Tous » plus one per route, in rank order) filter a vertical stack of ticket cards. Each ticket shows the route rank, departure and arrival with full station names, duration and train number.
- [x] The best candidate gets the « Meilleur choix » treatment. Out-of-window candidates stay listed after the in-window ones.
- [x] Each ticket explains its rank: how far from the ideal time, or how many minutes outside the window.
- [x] The snapshot freshness is shown on the leg view.
- [x] « Réserver » on a ticket opens the SNCF Connect `redirect` search link with the route's station codes and the candidate's date and departure time.
- [x] « Vérifier en direct sur SNCF Connect » at the end of the list opens the same link at the window's lower bound, or at the start of the day when the window has none.
- [x] The link builder lives in the domain core, with a test that pins the URL format.
- [x] Réglages has a « Pondération des gares » card (minutes per route rank, default 30): a slider plus a live worked example showing which route wins. Changing it immediately changes out-of-window ordering.
- [x] A tap on a home ticket half opens the corresponding leg view.
- [x] Playwright: open a leg, filter by route, change the route weight and see the out-of-window order flip for the fixture case.
