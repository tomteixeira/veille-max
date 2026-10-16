import type { SupabaseClient } from '@supabase/supabase-js'
import { saveLegReferences } from '#shared/utils/leg-reference-store'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller } from '../evaluation/traveller-evaluation'

/**
 * Resets the reference of every tracked leg of `travellerId` to its current
 * best candidate, without notifying (spec, "Settings writes"): after a
 * settings change, the traveller is looking at the app, and the next snapshot
 * only notifies what improves on what they saw. The legs whose ranking did not
 * change keep the reference the last snapshot left them.
 */
export async function resetLegReferences(client: SupabaseClient<Database>, travellerId: string, now: Date): Promise<void> {
  const { snapshotId, references } = await evaluateTraveller(client, travellerId, now)
  if (snapshotId !== null) await saveLegReferences(client, travellerId, snapshotId, references)
}
