# Veille MAX

Tracks MAX JEUNE seat availability on a traveller's preferred routes and tells them about the best train they could book for each upcoming weekend trip.

## Language

### Subscription

**MAX JEUNE**:
The SNCF subscription (16-27 y/o) giving free seats on TGV INOUI / Intercités trains, subject to a limited per-train quota released over time. The only subscription this product targets.
_Avoid_: TGV Max (former name), abonnement

### Trips and preferences

**Traveller**:
A MAX JEUNE subscriber using the app, owning their trip template, trips, bookings and notification devices.
_Avoid_: User (in domain language), customer, abonné

**Trip**:
One weekend's journey to the destination and back: an Outbound leg and a Return leg, each with its own date (Friday/Sunday by default). UI: « Week-end ».
_Avoid_: Weekend (in code), voyage, séjour

**Leg**:
One direction of a trip: the **Outbound** leg (UI: « Aller ») or the **Return** leg (UI: « Retour »). Each leg is configured, ranked and notified independently.
_Avoid_: Trajet, direction, segment

**Route**:
An ordered origin station → destination station pair the traveller accepts for a leg. A leg holds a ranked list of routes; rank 1 is the most preferred.
_Avoid_: Station preference, OD, liaison

**Time Window**:
The preferred time range of a leg, anchored on either departure or arrival (e.g. Outbound: arrive before 10:00; Return: depart after 14:00). A soft constraint: trains inside it rank above trains outside it, but trains outside it are still proposed. UI: « Fenêtre optimale ».
_Avoid_: Filter, plage horaire, créneau

**Ideal Time**:
The single perfect time of a leg, on the same anchor as its time window (e.g. Outbound: arrive at 9:00; Return: depart around 17:00).
_Avoid_: Target time, heure cible

**Trip Template**:
The default leg settings (weekday, routes, time window, ideal time) from which every trip in the tracking horizon is generated. UI: « Configuration par défaut ».
_Avoid_: Profile, settings, preset

**Customised Trip**:
A trip whose leg settings were edited (date, routes, window, ideal time). It is detached from the trip template and no longer follows its changes until reset.
_Avoid_: Override, exception

### Availability

**Snapshot**:
The daily picture of MAX JEUNE availability for every train, published once each morning by SNCF open data. The only source of availability.
_Avoid_: Scan, poll, refresh, crawl

**Opening**:
A run of consecutive snapshots in which a given train, on a given route and date, has an open MAX JEUNE seat. Its first snapshot, counted in days before departure, is when that seat "came out". UI: « Sortie de places ».
_Avoid_: Release, drop, availability window

**Candidate**:
A train with an open MAX JEUNE seat, on one of a leg's routes, on the leg's date, in the latest snapshot.
_Avoid_: Option, offer, « train dispo »

**Ranking**:
The order of a leg's candidates. Candidates inside the time window always come first, ordered by route rank then closeness to the ideal time. Candidates outside it follow, ordered by their distance to the window plus the route weight for each rank below 1, so a slightly later train from a better route can win.
_Avoid_: Score, rating

**Route Weight**:
How many minutes outside the time window one step of route rank is worth when ranking out-of-window candidates (default 30). A per-traveller setting. UI: « Pondération des gares ».
_Avoid_: Penalty, coefficient

**Best Candidate**:
The top-ranked candidate of a leg.

**Booking**:
The train the traveller declared they reserved for a leg. At most one per leg; declaring a new one replaces it.
_Avoid_: Reservation (in code), ticket, billet

**Improvement**:
A snapshot in which a leg's best candidate ranks strictly above its reference: the previous snapshot's best candidate, or the booking if it ranks higher. The first candidate appearing on an empty leg is an improvement. Improvements are the only availability events that trigger a notification. UI: « Nouveautés ».
_Avoid_: Alert, new train, match

### Tracking

**Tracking Horizon**:
The rolling 30-day period ahead of today during which trips are tracked, matching the MAX JEUNE booking window. A trip stays tracked until its legs have departed, then is archived.
_Avoid_: « Les 4 prochains week-ends »

**Upcoming Trip**:
A trip just beyond the tracking horizon (the next two weekends), shown with its opening date so it can be customised or muted in advance. It becomes tracked automatically when it enters the horizon.
_Avoid_: Future trip, draft

**Muted**:
State of a trip or a single leg that is still tracked and displayed but never triggers notifications. Used for weekends the traveller does not plan to travel but may decide to at the last minute.
_Avoid_: Disabled, inactive, désactivé

**Confirmation Reminder**:
The notification sent at noon the day before a booked leg, reminding the traveller to confirm the booking in their MAX JEUNE account before SNCF's 17:00 deadline. Tapping it opens the list of legs to confirm today, one tap away from the MAX JEUNE confirmation page in Safari.
_Avoid_: Validation alert
