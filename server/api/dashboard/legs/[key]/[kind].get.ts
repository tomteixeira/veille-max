import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { isLegKind } from '#shared/domain/trip-template'
import type { Database } from '#shared/types/database.types'
import { loadLegHistory, type LegHistoryView } from '../../../../dashboard/dashboard-view'

/** How one leg of a tracked or archived trip of the signed-in traveller evolved, snapshot by snapshot. */
export default defineEventHandler(async (event): Promise<LegHistoryView> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const key = getRouterParam(event, 'key')!
  const kind = getRouterParam(event, 'kind')!
  if (!isLegKind(kind)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const history = await loadLegHistory(await serverSupabaseClient<Database>(event), traveller.sub, new Date(), key, kind)
  if (!history) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return history
})
