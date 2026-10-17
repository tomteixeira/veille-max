import type { SupabaseClient } from '@supabase/supabase-js'
import { saveLegReferences } from '#shared/utils/leg-reference-store'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller } from '../evaluation/traveller-evaluation'

/**
 * Resets the reference of each leg of `travellerId` whose settings changed
 * (or that has none yet) to its current best candidate, without notifying
 * (spec, "Settings writes"): after a settings change, the traveller is looking
 * at the app, and the next snapshot only notifies what improves on what they
 * saw. The other legs keep the reference the last snapshot left them, so a
 * snapshot not evaluated yet still notifies them.
 */
export async function resetLegReferences(client: SupabaseClient<Database>, travellerId: string, now: Date): Promise<void> {
  const { snapshotId, resets } = await evaluateTraveller(client, travellerId, now)
  if (snapshotId !== null) await saveLegReferences(client, travellerId, snapshotId, resets)
}
