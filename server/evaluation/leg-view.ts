import type { SupabaseClient } from '@supabase/supabase-js'
import type { Leg } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller, legStationCodes } from './traveller-evaluation'

/** What the leg view shows (spec, "Evaluation read API"): one leg of a tracked trip, with every ranked candidate. */
export interface LegView {
  tripKey: string
  leg: Leg
  /** The route weight the candidates were ranked with. */
  routeWeight: number
  /** The full name of every station the leg's routes and candidates use, by code. */
  stationNames: Record<string, string>
}

/** The leg `kind` of trip `tripKey` for `travellerId` at `now`, or `null` when that trip is not tracked. */
export async function loadLegView(client: SupabaseClient<Database>, travellerId: string, now: Date, tripKey: string, kind: LegKind): Promise<LegView | null> {
  const { routeWeight, trips, stationNames } = await evaluateTraveller(client, travellerId, now)
  const trip = trips.find(trip => trip.key === tripKey)
  if (!trip) return null

  const leg = trip.legs[kind]
  const codes = new Set(legStationCodes(leg))
  return { tripKey, leg, routeWeight, stationNames: Object.fromEntries(Object.entries(stationNames).filter(([code]) => codes.has(code))) }
}
