import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { notifyImprovements, type ImprovementsSummary } from '../improvements/notify-improvements'
import { sendConfirmationReminders } from '../push/confirmation-reminders'
import type { PushGateway } from '../push/push-gateway'
import { ingestSnapshot, type IngestionResult } from '../snapshots/ingest-snapshot'
import type { SnapshotSource } from '../snapshots/snapshot-source'

export interface TickDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  source: SnapshotSource
  /** `null` when notifications are not configured: snapshots are then ingested, but not evaluated, and no reminder is sent. */
  gateway: PushGateway | null
  /** The current instant. */
  now: Date
}

/** What a tick did: the snapshot ingestion, the improvements it notified, and how many Confirmation Reminders it sent. */
export interface TickSummary extends IngestionResult {
  /** `null` when the latest snapshot had already been evaluated, or could not be. */
  improvements: ImprovementsSummary | null
  reminders: number
}

/**
 * One run of the background jobs, every 15 minutes (ADR 0003): does whatever
 * is due, and nothing twice. Ingests a new snapshot when SNCF has published
 * one, then evaluates every traveller against it and notifies their
 * improvements. Meanwhile, sends the Confirmation Reminders due: a snapshot
 * SNCF cannot serve does not hold them back.
 */
export async function runTick({ db, source, gateway, now }: TickDependencies): Promise<TickSummary> {
  const [snapshot, reminders] = await Promise.allSettled([
    (async () => {
      const ingestion = await ingestSnapshot({ db, source, now })
      const improvements = gateway ? await notifyImprovements({ db, gateway, now }) : null
      return { ...ingestion, improvements }
    })(),
    gateway ? sendConfirmationReminders({ db, gateway, now }) : 0,
  ])
  if (snapshot.status === 'rejected') throw snapshot.reason
  if (reminders.status === 'rejected') throw reminders.reason

  const { ingested, snapshotId, counts, improvements } = snapshot.value
  return { ingested, snapshotId, counts, improvements, reminders: reminders.value }
}
