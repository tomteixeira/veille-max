import type { SupabaseClient } from '@supabase/supabase-js'
import type { Route } from '#shared/domain/trip-template'
import { addDays, parisDate } from '#shared/utils/paris-time'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import type { Database } from '#shared/types/database.types'
import type { SnapshotSource } from './snapshot-source'

/** How many days after today the ingestion collects: the MAX JEUNE booking window (CONTEXT.md, Tracking Horizon). */
const HORIZON_DAYS = 30

export interface SnapshotCounts {
  /** Trains the snapshot lists on the tracked routes, open or not. */
  trains: number
  /** Of those, the trains with an open MAX JEUNE seat. */
  openTrains: number
  openingsOpened: number
  openingsKept: number
  openingsClosed: number
}

export interface IngestionResult {
  /** Whether this call recorded a new snapshot. */
  ingested: boolean
  /** The latest recorded snapshot, `null` before the first one. */
  snapshotId: number | null
  /** What the new snapshot changed, `null` when nothing was ingested. */
  counts: SnapshotCounts | null
}

/**
 * Ingests the snapshot `source` publishes, unless it is the last one ingested
 * (spec, "Snapshot ingestion"): records the trains of every tracked route from
 * today to D+30 in Paris, and opens or closes their openings. `db` is a
 * server-role client; `now` is the current instant.
 */
export async function ingestSnapshot({ db, source, now }: { db: SupabaseClient<Database>, source: SnapshotSource, now: Date }): Promise<IngestionResult> {
  const [processedAt, last] = await Promise.all([source.processedAt(), loadLastSnapshot(db)])
  if (last && last.processedAt.getTime() === processedAt.getTime()) {
    return { ingested: false, snapshotId: last.id, counts: null }
  }

  const today = parisDate(now)
  const trains = await source.trains(await trackedRoutes(db), { from: today, to: addDays(today, HORIZON_DAYS) })

  const { data, error } = await db.rpc('record_snapshot', {
    processed_at: processedAt.toISOString(),
    ingested_at: now.toISOString(),
    trains: trains.map(train => ({
      date: train.date,
      train_number: train.trainNumber,
      origin_code: train.originCode,
      destination_code: train.destinationCode,
      departure_time: train.departureTime,
      arrival_time: train.arrivalTime,
      open: train.open,
    })),
  })
  if (error) throw error

  // Null when a concurrent tick recorded the same snapshot first.
  const recorded = data as { snapshot_id: number, openings_opened: number, openings_kept: number, openings_closed: number } | null
  if (!recorded) return { ingested: false, snapshotId: (await loadLastSnapshot(db))?.id ?? null, counts: null }

  return {
    ingested: true,
    snapshotId: recorded.snapshot_id,
    counts: {
      trains: trains.length,
      openTrains: trains.filter(train => train.open).length,
      openingsOpened: recorded.openings_opened,
      openingsKept: recorded.openings_kept,
      openingsClosed: recorded.openings_closed,
    },
  }
}

async function trackedRoutes(db: SupabaseClient<Database>): Promise<Route[]> {
  const { data, error } = await db.rpc('tracked_routes')
  if (error) throw error
  return data.map(route => ({ originCode: route.origin_code, destinationCode: route.destination_code }))
}
