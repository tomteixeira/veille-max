import type { SupabaseClient } from '@supabase/supabase-js'
import type { Leg, TrainObservation } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import { loadTrainsOfDay } from '#shared/utils/observation-store'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller, legStationCodes } from './traveller-evaluation'

/** What the leg view shows (spec, "Evaluation read API"): one leg of a tracked trip, with every ranked candidate and its booking. */
export interface LegView {
  tripKey: string
  leg: Leg
  /** The route weight the candidates were ranked with. */
  routeWeight: number
  /** The full name of every station the leg's routes, candidates and booking use, by code. */
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

/** A train the traveller can declare as booked for a leg. */
export interface BookableTrain extends TrainObservation {
  /** The rank of the train's route among the leg's routes; 1 is the most preferred. */
  routeRank: number
}

/**
 * Every train the latest snapshot lists on a leg's date and routes, open or
 * not, by departure time (spec, "Evaluation read API"): what the traveller can
 * declare as booked. `null` when that trip is not tracked.
 */
export async function loadBookableTrains(client: SupabaseClient<Database>, travellerId: string, now: Date, tripKey: string, kind: LegKind): Promise<BookableTrain[] | null> {
  const [view, snapshot] = await Promise.all([loadLegView(client, travellerId, now, tripKey, kind), loadLastSnapshot(client)])
  if (!view) return null
  if (!snapshot) return []

  const { date, settings: { routes } } = view.leg
  const trains = await loadTrainsOfDay(client, snapshot.id, routes, date)
  return trains.map(train => ({
    ...train,
    routeRank: routes.findIndex(route => route.originCode === train.originCode && route.destinationCode === train.destinationCode) + 1,
  }))
}
