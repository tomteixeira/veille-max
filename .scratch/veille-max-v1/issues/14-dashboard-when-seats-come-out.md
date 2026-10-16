# 14: Dashboard: when seats come out

**What to build:** The dashboard helps the traveller understand when MAX JEUNE seats come out on their routes. It shows three charts: a release curve by days before departure, availability by weekday and departure hour, and how long openings last. It is filtered by default on the traveller's trip weekdays. See user stories 59–61 and 63 in the spec.

**Blocked by:** 04 (Daily snapshot ingestion)

**Status:** ready-for-agent

- [ ] The dashboard follows the "Histoires" layout (see the spec's UI module). It is a stack of cards, each titled with its one-sentence conclusion computed from the data (e.g. « Les places sortent en trois vagues : J-29, J-11 et J-3. »), with the chart underneath.
- [ ] Release curve: one column per D-n with the number of Openings that started that day on the traveller's routes. The wave peaks are emphasised and labelled, and tapping a column shows its value.
- [ ] Availability heatmap: weekday × train departure-hour band, on a single orange sequential ramp, with the percentage in each cell.
- [ ] Distribution of Opening lifetimes as horizontal bars.
- [ ] A filter defaults to the template weekdays (e.g. Friday and Sunday), with a switch to all days.
- [ ] An empty state explains that history starts at the first ingested snapshot and gives its date.
- [ ] Aggregates are computed on the server from observations and Openings and returned by an authenticated endpoint.
- [ ] Charts render client-side without breaking SSR, are readable on mobile and support both themes.
- [ ] Integration (seam 2): aggregates are correct for a known sequence of fixture snapshots.
- [ ] Playwright: the dashboard renders the three charts with seeded data, and the weekday filter changes them.
