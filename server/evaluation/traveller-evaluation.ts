import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluate, TRACKING_HORIZON_DAYS, type Leg, type Trip } from '#shared/domain/evaluation'
import { loadBookings } from '#shared/utils/booking-store'
import { loadOpenTrains } from '#shared/utils/observation-store'
import { addDays, parisDate } from '#shared/utils/paris-time'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import { loadRouteWeight } from '#shared/utils/traveller-settings-store'
import { loadTripTemplate } from '#shared/utils/trip-template-store'
import type { Database } from '#shared/types/database.types'

export interface TravellerEvaluation {
  /** The route weight the candidates were ranked with. */
  routeWeight: number
  /** Whether the traveller's trip template ranks any route yet. */
  hasRoutes: boolean
  /** The tracked trips, soonest first, each leg with its ranked candidates in the latest snapshot and its booking. */
  trips: Trip[]
  /** How many bookings the traveller holds for legs that have not passed. */
  activeBookings: number
  /** The full name of every station the trips' routes and candidates use, by code. */
  stationNames: Record<string, string>
}

/**
 * Evaluates the situation of `travellerId` at `now`: their settings and the
 * latest snapshot's trains on their routes, through the domain core. `client`
 * is the traveller's own client, so RLS limits it to their rows.
 */
export async function evaluateTraveller(client: SupabaseClient<Database>, travellerId: string, now: Date): Promise<TravellerEvaluation> {
  const [template, routeWeight, bookings, snapshot] = await Promise.all([
    loadTripTemplate(client, travellerId),
    loadRouteWeight(client, travellerId),
    loadBookings(client, travellerId),
    loadLastSnapshot(client),
  ])
  const routes = [...template.outbound.routes, ...template.return.routes]

  const today = parisDate(now)
  const observations = snapshot
    ? await loadOpenTrains(client, snapshot.id, routes, { from: today, to: addDays(today, TRACKING_HORIZON_DAYS) })
    : []
  const { trips, activeBookings } = evaluate({ now, settings: { template, routeWeight, bookings }, observations })

  return { routeWeight, hasRoutes: routes.length > 0, trips, activeBookings, stationNames: await loadStationNames(client, trips) }
}

/** The code of every station a leg's routes, candidates and booking use. */
export function legStationCodes(leg: Leg): string[] {
  const trains = [...leg.candidates.map(({ train }) => train), ...(leg.booking ? [leg.booking.train] : [])]
  return [...leg.settings.routes, ...trains].flatMap(route => [route.originCode, route.destinationCode])
}

async function loadStationNames(client: SupabaseClient<Database>, trips: readonly Trip[]): Promise<Record<string, string>> {
  const codes = new Set(trips.flatMap(trip => Object.values(trip.legs).flatMap(legStationCodes)))
  if (codes.size === 0) return {}

  const { data, error } = await client.from('stations').select('code, name').in('code', [...codes])
  if (error) throw error
  return Object.fromEntries(data.map(station => [station.code, station.name]))
}
