# 04: Daily snapshot ingestion

**What to build:** Every morning, the app reads the SNCF open-data snapshot and records the availability history of every route in the travellers' trip templates. It runs in production as early as possible, so dashboard history starts accumulating. The app shows when the last snapshot was taken. See ADR 0001, ADR 0003 and "Snapshot ingestion" / "Tick endpoint" in the spec.

**Blocked by:** 03 (Default configuration)

**Status:** ready-for-agent

- [x] A tick endpoint, protected by a shared secret header, rejects calls without a valid secret.
- [x] A migration schedules a `pg_cron` job every 15 minutes that calls the tick through `pg_net`, with the secret read from Vault and a raised timeout.
- [x] A `SnapshotSource` port with a real adapter reads the dataset's processed timestamp and exports, through the filtered export endpoint, the rows of a set of routes from today to D+30. Duplicate rows (same date, train, origin, destination) are merged, and the result is open if any copy says OUI.
- [x] The tracked routes are the union of all travellers' template routes.
- [x] Ingestion only runs when the processed timestamp differs from the last ingested snapshot. It records the snapshot, upserts train observations (date, train number, origin, destination, departure, arrival, first and last seen) and opens or closes Openings.
- [x] The tick returns a summary: whether it ingested, the snapshot id, counts.
- [x] The app shows « Dernier instantané : <date, heure> ».
- [x] Integration tests (seam 2, local Supabase, fixture `SnapshotSource`, injected clock): two successive fixture snapshots open, keep and close Openings correctly; the same timestamp twice is a no-op; a call without the secret is rejected. (The secret check is tested by `test/unit/tick-secret.test.ts` and, through the real endpoint, by `test/e2e/tick.spec.ts`: the integration tests call the tick without HTTP.)
- [ ] Deployed to production right after merge, with the `pg_cron` job active.
