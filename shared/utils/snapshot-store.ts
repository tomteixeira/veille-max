import type { SupabaseClient } from '@supabase/supabase-js'
import type { HistorySnapshot } from '../domain/leg-history'
import type { Database } from '../types/database.types'
import { parisDate } from './paris-time'

// Reads the ingested snapshots (table `snapshots`), which every signed-in
// traveller may read.

export interface IngestedSnapshot {
  id: number
  /** When SNCF took the snapshot. */
  processedAt: Date
}

/** The latest snapshot the app ingested, or `null` before the first one. */
export async function loadLastSnapshot(client: SupabaseClient<Database>): Promise<IngestedSnapshot | null> {
  const { data, error } = await client.from('snapshots')
    .select('id, processed_at')
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data && { id: data.id, processedAt: new Date(data.processed_at) }
}

// The Data API returns at most this many rows per request (`max_rows`, supabase/config.toml).
const PAGE_SIZE = 1000

/** Every snapshot the app ingested, oldest first, by the Paris day SNCF took it. */
export async function loadSnapshots(client: SupabaseClient<Database>): Promise<HistorySnapshot[]> {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('snapshots')
      .select('id, processed_at')
      .order('processed_at')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows.map(row => ({ id: row.id, day: parisDate(new Date(row.processed_at)) }))
}
