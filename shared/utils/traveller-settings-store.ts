import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ROUTE_WEIGHT } from '../domain/evaluation'
import type { Database } from '../types/database.types'

// Reads and writes a traveller's settings outside the trip template (table
// `traveller_settings`). With a traveller's client, RLS limits every read and
// write to their own row.

type Client = SupabaseClient<Database>

/** The route weight of `travellerId`: the one they saved, or the default. */
export async function loadRouteWeight(client: Client, travellerId: string): Promise<number> {
  const { data, error } = await client.from('traveller_settings').select('route_weight').eq('user_id', travellerId).maybeSingle()
  if (error) throw error
  return data?.route_weight ?? DEFAULT_ROUTE_WEIGHT
}

/** Saves the route weight of `travellerId`, who must be the signed-in traveller. */
export async function saveRouteWeight(client: Client, travellerId: string, routeWeight: number): Promise<void> {
  const { error } = await client.from('traveller_settings').upsert({ user_id: travellerId, route_weight: routeWeight })
  if (error) throw error
}
