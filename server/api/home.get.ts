import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller, type TravellerEvaluation } from '../evaluation/traveller-evaluation'

/** The home view of the signed-in traveller: their tracked trips, with each leg's ranked candidates. */
export default defineEventHandler(async (event): Promise<TravellerEvaluation> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  return evaluateTraveller(await serverSupabaseClient<Database>(event), traveller.sub, new Date())
})
