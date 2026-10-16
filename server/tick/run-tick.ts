import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { sendConfirmationReminders } from '../push/confirmation-reminders'
import type { PushGateway } from '../push/push-gateway'
import { ingestSnapshot, type IngestionResult } from '../snapshots/ingest-snapshot'
import type { SnapshotSource } from '../snapshots/snapshot-source'

export interface TickDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  source: SnapshotSource
  /** Where notifications go; `null` when push is not configured, and nothing is sent. */
  gateway: PushGateway | null
  /** The current instant. */
  now: Date
}

/** What a tick did: the snapshot ingestion, and how many Confirmation Reminders it sent. Improvement notifications will join it. */
export interface TickSummary extends IngestionResult {
  reminders: number
}

/**
 * One run of the background jobs, every 15 minutes (ADR 0003): does whatever
 * is due, and nothing twice. Ingests a new snapshot when SNCF has published
 * one, and sends the Confirmation Reminders due. Neither waits for the other:
 * a snapshot SNCF cannot serve does not hold the reminders back.
 */
export async function runTick({ db, source, gateway, now }: TickDependencies): Promise<TickSummary> {
  const [ingestion, reminders] = await Promise.allSettled([
    ingestSnapshot({ db, source, now }),
    gateway ? sendConfirmationReminders({ db, gateway, now }) : 0,
  ])
  if (ingestion.status === 'rejected') throw ingestion.reason
  if (reminders.status === 'rejected') throw reminders.reason

  const { ingested, snapshotId, counts } = ingestion.value
  return { ingested, snapshotId, counts, reminders: reminders.value }
}
