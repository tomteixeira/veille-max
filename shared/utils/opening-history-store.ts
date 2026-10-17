import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpeningHistory } from '../domain/opening-history'
import type { Route, Weekday } from '../domain/trip-template'
import type { Database } from '../types/database.types'

// Reads the availability history of a traveller's routes, counted by the
// database from the snapshots, train observations and openings (function
// `opening_history`), which every signed-in traveller may read.

export interface RoutesHistory {
  /** When SNCF took the first ingested snapshot: the start of every history, `null` before it. */
  firstSnapshotAt: Date | null
  history: OpeningHistory
}

interface HistoryRow {
  first_snapshot_at: string | null
  starts: { weekday: Weekday, days_before: number, openings: number }[]
  slots: { weekday: Weekday, hour: number, listed: number, open: number }[]
  lifetimes: { weekday: Weekday, days: number, openings: number }[]
}

/** The availability history of `routes`, since the first ingested snapshot. */
export async function loadOpeningHistory(client: SupabaseClient<Database>, routes: readonly Route[]): Promise<RoutesHistory> {
  const { data, error } = await client.rpc('opening_history', {
    routes: routes.map(route => ({ origin_code: route.originCode, destination_code: route.destinationCode })),
  })
  if (error) throw error

  const row = data as unknown as HistoryRow
  return {
    firstSnapshotAt: row.first_snapshot_at === null ? null : new Date(row.first_snapshot_at),
    history: {
      starts: row.starts.map(({ weekday, days_before, openings }) => ({ weekday, daysBefore: days_before, openings })),
      slots: row.slots,
      lifetimes: row.lifetimes,
    },
  }
}
