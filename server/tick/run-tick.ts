import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { ingestSnapshot, type IngestionResult } from '../snapshots/ingest-snapshot'
import type { SnapshotSource } from '../snapshots/snapshot-source'

export interface TickDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  source: SnapshotSource
  /** The current instant. */
  now: Date
}

/** What a tick did: so far, the snapshot ingestion. Notifications and reminders will join it. */
export type TickSummary = IngestionResult

/**
 * One run of the background jobs, every 15 minutes (ADR 0003): does whatever
 * is due, and nothing twice. Today, ingests a new snapshot when SNCF has
 * published one.
 */
export async function runTick({ db, source, now }: TickDependencies): Promise<TickSummary> {
  const { ingested, snapshotId, counts } = await ingestSnapshot({ db, source, now })
  return { ingested, snapshotId, counts }
}
