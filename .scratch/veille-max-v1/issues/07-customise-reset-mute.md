# 07: Customise, reset and mute trips

**What to build:** The traveller can customise a specific trip. They can change its leg dates, routes, window and ideal time. The trip is detached from the template on its first edit and can be reset to it. The traveller can prepare the two upcoming trips beyond the horizon in advance. They can mute a whole trip or a single leg: it stays tracked and visible but never notifies. See user stories 19–30 in the spec.

**Blocked by:** 05 (Home: trips and best candidates)

**Status:** ready-for-agent

- [ ] Editing a trip copies the template's leg settings into it on the first change. It is marked « Personnalisé » and offers « Réinitialiser ».
- [ ] A trip's leg date (e.g. Thursday or Monday), routes (add, remove, reorder), window and ideal time can be changed.
- [ ] Template changes propagate to non-customised trips only.
- [ ] The next two weekends after the horizon appear in the home screen's « Bientôt ouverts » section, with « Ouverture le JJ/MM » and a « Préparer » action. They can be customised and muted, and move into the carousel automatically when they enter the horizon.
- [ ] Trip-level and leg-level mute toggles exist. A muted trip or leg shows « En sourdine » and keeps its candidates displayed.
- [ ] Trips whose legs have all passed are archived: hidden from the home screen, not deleted.
- [ ] Snapshot ingestion also tracks the routes of customised trips in the horizon.
- [ ] Customisations and mutes are owned by the traveller and protected by RLS.
- [ ] Vitest (seam 1): copy-on-write, reset, template propagation, upcoming-to-tracked transition, archiving.
- [ ] Integration (seam 2): a customised route is ingested.
- [ ] Playwright: customise a trip to another destination, reset it, mute a leg.
