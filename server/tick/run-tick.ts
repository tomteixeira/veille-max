import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { notifyImprovements, type ImprovementsSummary } from '../improvements/notify-improvements'
import type { PushGateway } from '../push/push-gateway'
import { ingestSnapshot, type IngestionResult } from '../snapshots/ingest-snapshot'
import type { SnapshotSource } from '../snapshots/snapshot-source'

export interface TickDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  source: SnapshotSource
  /** `null` when notifications are not configured: snapshots are then ingested, but not evaluated. */
  gateway: PushGateway | null
  /** The current instant. */
  now: Date
}

/** What a tick did: the snapshot ingestion, then the improvements it notified. Reminders will join it. */
export interface TickSummary extends IngestionResult {
  /** `null` when the latest snapshot had already been evaluated, or could not be. */
  improvements: ImprovementsSummary | null
}

/**
 * One run of the background jobs, every 15 minutes (ADR 0003): does whatever
 * is due, and nothing twice. Ingests a new snapshot when SNCF has published
 * one, then evaluates every traveller against it and notifies their
 * improvements.
 */
export async function runTick({ db, source, gateway, now }: TickDependencies): Promise<TickSummary> {
  const { ingested, snapshotId, counts } = await ingestSnapshot({ db, source, now })
  const improvements = gateway ? await notifyImprovements({ db, gateway, now }) : null
  return { ingested, snapshotId, counts, improvements }
}
