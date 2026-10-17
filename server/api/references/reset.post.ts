import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { resetLegReferences } from '../../improvements/reset-leg-references'

/**
 * Called after the signed-in traveller changes settings that rank their legs:
 * resets each leg's reference to its current best candidate, without notifying.
 */
export default defineEventHandler(async (event): Promise<void> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  await resetLegReferences(await serverSupabaseClient<Database>(event), traveller.sub, new Date())
  setResponseStatus(event, 204)
})
