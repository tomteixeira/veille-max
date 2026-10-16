import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { isLegKind } from '#shared/domain/trip-template'
import type { Database } from '#shared/types/database.types'
import { loadLegView, type LegView } from '../../../../evaluation/leg-view'

/** One leg of a tracked trip of the signed-in traveller, with every ranked candidate. */
export default defineEventHandler(async (event): Promise<LegView> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const key = getRouterParam(event, 'key')!
  const kind = getRouterParam(event, 'kind')!
  if (!isLegKind(kind)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const view = await loadLegView(await serverSupabaseClient<Database>(event), traveller.sub, new Date(), key, kind)
  if (!view) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return view
})
