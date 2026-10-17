import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { isDashboardFilter, loadDashboard, type DashboardView } from '../../dashboard/dashboard-view'

/** The dashboard of the signed-in traveller: when seats come out on their routes, on their trip weekdays (`?days=trip`, the default) or every day (`?days=all`), their bookings, and the legs whose history they can replay. */
export default defineEventHandler(async (event): Promise<DashboardView> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { days = 'trip' } = getQuery(event)
  if (!isDashboardFilter(days)) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  return loadDashboard(await serverSupabaseClient<Database>(event), traveller.sub, days, new Date())
})
