import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomisedLeg, TripCustomisation, TripMute } from '../domain/evaluation'
import type { LegKind } from '../domain/trip-template'
import type { Database, Tables } from '../types/database.types'
import { legSettings } from './trip-template-store'

// Reads and writes a traveller's customised trips (tables
// `customised_trip_legs` and `customised_trip_routes`) and mutes (table
// `mutes`) in Supabase. With a traveller's client, RLS limits every read and
// write to their own rows.

type Client = SupabaseClient<Database>

/** The customised trips of `travellerId`, by trip key. */
export async function loadCustomisations(client: Client, travellerId: string): Promise<Record<string, TripCustomisation>> {
  const [legs, routes] = await Promise.all([
    client.from('customised_trip_legs').select().eq('user_id', travellerId),
    client.from('customised_trip_routes').select().eq('user_id', travellerId).order('rank'),
  ])
  if (legs.error) throw legs.error
  if (routes.error) throw routes.error

  const customisations: Record<string, Partial<TripCustomisation>> = {}
  for (const row of legs.data) {
    customisations[row.trip_key] = { ...customisations[row.trip_key], [row.kind]: customisedLeg(row, routes.data) }
  }
  // A trip is saved with both its legs at once.
  return customisations as Record<string, TripCustomisation>
}

function customisedLeg(row: Tables<'customised_trip_legs'>, routes: Tables<'customised_trip_routes'>[]): CustomisedLeg {
  const legRoutes = routes.filter(route => route.trip_key === row.trip_key && route.leg_kind === row.kind)
  return { date: row.travel_date, ...legSettings(row, legRoutes) }
}

/** Saves both legs of one of the signed-in traveller's customised trips, replacing their ranked routes, in one transaction. */
export async function saveCustomisedTrip(client: Client, tripKey: string, customisation: TripCustomisation): Promise<void> {
  const legs = (Object.entries(customisation) as [LegKind, CustomisedLeg][]).map(([kind, leg]) => ({
    kind,
    travel_date: leg.date,
    anchor: leg.anchor,
    window_start: leg.window.start,
    window_end: leg.window.end,
    ideal_time: leg.idealTime,
    routes: leg.routes.map(route => ({ origin_code: route.originCode, destination_code: route.destinationCode })),
  }))
  const { error } = await client.rpc('save_customised_trip', { trip_key: tripKey, legs })
  if (error) throw error
}

/** Gives one of the signed-in traveller's trips back to the trip template. */
export async function resetTrip(client: Client, tripKey: string): Promise<void> {
  const { error } = await client.from('customised_trip_legs').delete().eq('trip_key', tripKey)
  if (error) throw error
}

/** The muted trips and legs of `travellerId`. */
export async function loadMutes(client: Client, travellerId: string): Promise<TripMute[]> {
  const { data, error } = await client.from('mutes').select('trip_key, leg_kind').eq('user_id', travellerId)
  if (error) throw error
  return data.map(row => (row.leg_kind === null ? { tripKey: row.trip_key } : { tripKey: row.trip_key, leg: row.leg_kind }))
}

/** Mutes or unmutes one of the signed-in traveller's trips, or only one of its legs. */
export async function setMute(client: Client, { tripKey, leg }: TripMute, muted: boolean): Promise<void> {
  const { error } = muted
    ? await client.from('mutes').upsert({ trip_key: tripKey, leg_kind: leg ?? null }, { onConflict: 'user_id,trip_key,leg_kind', ignoreDuplicates: true })
    : await (leg ? client.from('mutes').delete().eq('leg_kind', leg) : client.from('mutes').delete().is('leg_kind', null)).eq('trip_key', tripKey)
  if (error) throw error
}
