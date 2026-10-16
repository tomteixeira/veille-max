import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

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
