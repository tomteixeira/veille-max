import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { loadHomeView, type HomeView } from '../evaluation/home-view'

/** The home view of the signed-in traveller: their tracked trips, with each leg's ranked candidates, and this morning's improvements. */
export default defineEventHandler(async (event): Promise<HomeView> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  return loadHomeView(await serverSupabaseClient<Database>(event), traveller.sub, new Date())
})
