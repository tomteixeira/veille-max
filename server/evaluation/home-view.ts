import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluate, TRACKING_HORIZON_DAYS, type Trip } from '#shared/domain/evaluation'
import { loadOpenTrains } from '#shared/utils/observation-store'
import { addDays, parisDate } from '#shared/utils/paris-time'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import { loadTripTemplate } from '#shared/utils/trip-template-store'
import type { Database } from '#shared/types/database.types'

/** What the home screen shows (spec, "Evaluation read API"). */
export interface HomeView {
  /** Whether the traveller's trip template ranks any route yet. */
  hasRoutes: boolean
  /** The tracked trips, soonest first, each leg with its ranked candidates in the latest snapshot. */
  trips: Trip[]
  /** The full name of every station the trips' candidates use, by code. */
  stationNames: Record<string, string>
}

/**
 * Evaluates the situation of `travellerId` at `now`: their settings and the
 * latest snapshot's trains on their routes, through the domain core. `client`
 * is the traveller's own client, so RLS limits it to their rows.
 */
export async function loadHomeView(client: SupabaseClient<Database>, travellerId: string, now: Date): Promise<HomeView> {
  const [template, snapshot] = await Promise.all([loadTripTemplate(client, travellerId), loadLastSnapshot(client)])
  const routes = [...template.outbound.routes, ...template.return.routes]

  const today = parisDate(now)
  const observations = snapshot
    ? await loadOpenTrains(client, snapshot.id, routes, { from: today, to: addDays(today, TRACKING_HORIZON_DAYS) })
    : []
  const { trips } = evaluate({ now, settings: { template }, observations })

  return { hasRoutes: routes.length > 0, trips, stationNames: await loadStationNames(client, trips) }
}

async function loadStationNames(client: SupabaseClient<Database>, trips: readonly Trip[]): Promise<Record<string, string>> {
  const codes = new Set(trips.flatMap(trip => Object.values(trip.legs).flatMap(leg =>
    leg.candidates.flatMap(({ train }) => [train.originCode, train.destinationCode]))))
  if (codes.size === 0) return {}

  const { data, error } = await client.from('stations').select('code, name').in('code', [...codes])
  if (error) throw error
  return Object.fromEntries(data.map(station => [station.code, station.name]))
}
