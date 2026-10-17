import type { SupabaseClient } from '@supabase/supabase-js'
import { bookingHabits, type BookingHabits } from '#shared/domain/booking-habits'
import { evaluate, sameRoute, type Trip } from '#shared/domain/evaluation'
import { legHistory, type HistoryLeg, type LegHistoryColumn } from '#shared/domain/leg-history'
import { openingDashboard, type OpeningDashboard } from '#shared/domain/opening-history'
import { LEG_KINDS, type LegKind, type LegSettings, type Route, type TripTemplate, type Weekday } from '#shared/domain/trip-template'
import { loadBookings } from '#shared/utils/booking-store'
import { loadObservedTrains } from '#shared/utils/observation-store'
import { loadOpeningHistory } from '#shared/utils/opening-history-store'
import { parisDate, type ParisDate } from '#shared/utils/paris-time'
import { loadSnapshots } from '#shared/utils/snapshot-store'
import { loadRouteWeight } from '#shared/utils/traveller-settings-store'
import { loadCustomisations } from '#shared/utils/trip-store'
import { loadStationNames, loadTripTemplate } from '#shared/utils/trip-template-store'
import type { Database } from '#shared/types/database.types'

type Client = SupabaseClient<Database>

/** The travel days the dashboard counts: the trip template's weekdays, or every day. */
export type DashboardFilter = 'trip' | 'all'

export function isDashboardFilter(value: unknown): value is DashboardFilter {
  return value === 'trip' || value === 'all'
}

/** What the dashboard shows (spec, "Evaluation read API"): when seats come out on the traveller's routes, and where they stand with bookings. */
export interface DashboardView extends OpeningDashboard {
  /** When SNCF took the first ingested snapshot, as an ISO instant: the start of the history, `null` before it. */
  since: string | null
  /** The weekdays of the traveller's trip template, outbound first, without duplicates. */
  tripWeekdays: Weekday[]
  filter: DashboardFilter
  /** Whether the traveller's trip template has any route to count. */
  hasRoutes: boolean
  bookings: BookingHabits
  /** The legs of the tracked trips and of the trips archived since the first snapshot, by date. */
  legs: HistoryLeg[]
}

/** The dashboard of `travellerId` at `now`: the history of their template routes, on the travel days of `filter`. */
export async function loadDashboard(client: Client, travellerId: string, filter: DashboardFilter, now: Date): Promise<DashboardView> {
  const template = await loadTripTemplate(client, travellerId)
  const routes: Route[] = []
  for (const kind of LEG_KINDS) {
    for (const route of template[kind].routes) {
      if (!routes.some(known => sameRoute(known, route))) routes.push(route)
    }
  }
  const tripWeekdays = [...new Set(LEG_KINDS.map(kind => template[kind].weekday))]

  const [{ firstSnapshotAt, history }, bookings] = await Promise.all([loadOpeningHistory(client, routes), loadBookings(client, travellerId)])
  const { trips } = await historyTrips(client, travellerId, template, now, firstSnapshotAt && parisDate(firstSnapshotAt))
  return {
    ...openingDashboard(history, filter === 'trip' ? tripWeekdays : 'all'),
    since: firstSnapshotAt?.toISOString() ?? null,
    tripWeekdays,
    filter,
    hasRoutes: routes.length > 0,
    bookings: bookingHabits(bookings, now),
    legs: trips
      .flatMap(trip => LEG_KINDS.map(kind => historyLeg(trip, kind, now)))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/** How one leg evolved, snapshot by snapshot (spec, user story 62). */
export interface LegHistoryView extends HistoryLeg {
  /** The leg's settings: those its candidates are ranked with in every snapshot. */
  settings: LegSettings
  routeWeight: number
  /** The full name of every station the leg's routes use, by code. */
  stationNames: Record<string, string>
  /** One column per snapshot of the leg's booking window, oldest first. */
  columns: LegHistoryColumn[]
}

/**
 * The history of leg `kind` of trip `tripKey` for `travellerId` at `now`, or
 * `null` when that trip is neither tracked nor archived since the first snapshot.
 */
export async function loadLegHistory(client: Client, travellerId: string, now: Date, tripKey: string, kind: LegKind): Promise<LegHistoryView | null> {
  const [snapshots, template] = await Promise.all([loadSnapshots(client), loadTripTemplate(client, travellerId)])
  const { trips, routeWeight } = await historyTrips(client, travellerId, template, now, snapshots[0]?.day ?? null)
  const trip = trips.find(trip => trip.key === tripKey)
  if (!trip) return null

  const leg = trip.legs[kind]
  const { date, settings } = leg
  const [trains, stationNames] = await Promise.all([
    loadObservedTrains(client, settings.routes, date),
    loadStationNames(client, settings.routes.flatMap(route => [route.originCode, route.destinationCode])),
  ])
  return {
    ...historyLeg(trip, kind, now),
    settings,
    routeWeight,
    stationNames,
    columns: legHistory(leg, routeWeight, snapshots, trains),
  }
}

function historyLeg(trip: Trip, kind: LegKind, now: Date): HistoryLeg {
  const { date } = trip.legs[kind]
  return { tripKey: trip.key, kind, date, past: date < parisDate(now) }
}

/**
 * The trips whose legs have a history, soonest first: the tracked ones, and
 * those archived since `firstSnapshotDay`, the Paris day of the first snapshot.
 */
async function historyTrips(client: Client, travellerId: string, template: TripTemplate, now: Date, firstSnapshotDay: ParisDate | null): Promise<{ trips: Trip[], routeWeight: number }> {
  const [routeWeight, customisations] = await Promise.all([loadRouteWeight(client, travellerId), loadCustomisations(client, travellerId)])
  const { trips, archived } = evaluate({
    now,
    settings: { template, routeWeight, customisations },
    observations: [],
    // Before the first snapshot, no trip was archived with a history.
    archivedSince: firstSnapshotDay ?? undefined,
  })
  return { trips: [...archived, ...trips], routeWeight }
}
