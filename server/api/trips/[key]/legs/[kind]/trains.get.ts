import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { isLegKind } from '#shared/domain/trip-template'
import type { Database } from '#shared/types/database.types'
import { loadBookableTrains, type BookableTrain } from '../../../../../evaluation/leg-view'

/** Every train of a leg's date on its routes in the latest snapshot, open or not: what the signed-in traveller can declare as booked. */
export default defineEventHandler(async (event): Promise<BookableTrain[]> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const key = getRouterParam(event, 'key')!
  const kind = getRouterParam(event, 'kind')!
  if (!isLegKind(kind)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const trains = await loadBookableTrains(await serverSupabaseClient<Database>(event), traveller.sub, new Date(), key, kind)
  if (!trains) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return trains
})
