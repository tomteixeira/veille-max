# 03: Default configuration (trip template)

**What to build:** The traveller describes their trip template once: for each leg, its weekday, time window, ideal time and ranked routes, picked from stations shown by their full names. It is stored per traveller and protected by RLS (ADR 0002).

**Blocked by:** 02 (Sign in with an email code)

**Status:** ready-for-agent

- [ ] A station reference covers the station codes present in the `tgvmax` dataset, built from `trainline-eu/stations` (`sncf_id`), with a hand-written override for the 10 city-level codes (Paris, Lyon, Lille stations). The refresh script is documented.
- [ ] Réglages shows the trip template as « Votre week-end type », drawn as the home ticket ("Billet modèle", see the spec's UI module). Each half shows the weekday, « Arriver avant » or « Partir après » with the time, a one-day bar (accepted zone plus a dot at the ideal time, with a caption in words) and the ranked route chips.
- [ ] Tapping a half opens a bottom-sheet editor: weekday chips (Friday / Sunday by default), Partir/Arriver (anchor) and avant/après (bound) segments with the time, the ideal time, the same day bar updating live, and the ranked routes. The UI exposes one bound per leg; the domain still accepts both bounds.
- [ ] Each leg holds a ranked list of routes. Routes are added with « + Ajouter une route » and a searchable origin and destination station picker, reordered with up and down buttons, and removed. The same route cannot appear twice in a leg.
- [ ] A new traveller starts with Friday outbound, Sunday return and no routes.
- [ ] Template data carries the traveller's `user_id`, and RLS prevents any traveller from reading or writing another's template (covered by a test).
- [ ] Playwright: configure two routes per leg with windows and ideal times, reorder them, reload, and find everything persisted.
