# Daily open-data snapshot is the only availability source

The public SNCF `tgvmax` dataset is refreshed once a day (~06:24 Paris), so seats released and taken within the same day are invisible to us. The only real-time sources (MAX JEUNE / SNCF Connect internal endpoints) sit behind DataDome and are explicitly forbidden by the SNCF Connect CGV, with ticket cancellation as a possible sanction. We accept the daily cadence: availability, ranking and notifications are computed once per snapshot. To cover intra-day releases, the app offers pre-filled SNCF Connect searches so the traveller can check by hand. A real-time source is deferred to a possible v2.

## Consequences

- Notifications arrive at most once a day per leg, shortly after the morning snapshot.
- The release dashboard can only measure days before departure (D-n), never the hour a seat appeared.
