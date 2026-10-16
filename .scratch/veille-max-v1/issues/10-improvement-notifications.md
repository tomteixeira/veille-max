# 10: Improvement notifications

**What to build:** Right after each new snapshot, the traveller gets one push notification per leg whose best candidate improved. That covers the first candidate on an empty leg, a new best, or a candidate strictly better than their booking. There is never a notification for muted trips, disappearing trains or trains that are not the new best. Tapping the notification opens the leg view. See "Improvement" in `CONTEXT.md` and "Ranking rules" / "Notifications" in the spec.

**Blocked by:** 07 (Customise, reset and mute trips), 08 (Bookings), 09 (Installable PWA and push devices)

**Status:** ready-for-agent

- [ ] After ingesting a new snapshot, the tick evaluates every traveller and persists each leg's reference best candidate.
- [ ] The domain core reports improvements of three kinds: first candidate, new best, better than booking. The reference is the better of the previous reference and the booking.
- [ ] One notification per improved leg, in French, with the stations, date, times and kind. Its click target is the in-scope leg view.
- [ ] The home screen shows a « Nouveautés » section between the trip carousel and « Bientôt ouverts ». It lists the latest snapshot's improvements on non-muted legs (leg, times, route, chip), and each item opens its leg. The home headline counts them (« 3 nouveaux trains ce matin. »).
- [ ] Muted trips and legs keep updating their reference but send nothing, so unmuting does not flood the traveller.
- [ ] A settings change that affects a leg's ranking resets its reference to the current best candidate without notifying.
- [ ] A notification log makes the tick idempotent: re-running it for the same snapshot sends nothing new.
- [ ] Vitest (seam 1) replays the design scenario. Route 3 appears: notify. Route 1 appears: notify. Route 2 appears: silent. Route 1 disappears: silent. Route 1 reappears: notify. Plus the booked-leg variants and the mute and unmute cases.
- [ ] Integration (seam 2): a sequence of fixture snapshots with the recording gateway produces exactly the expected notifications, to the right devices.
- [ ] Manual: a real improvement notification is received on the iPhone and opens the leg.
