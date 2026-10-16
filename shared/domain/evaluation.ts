/**
 * The domain core (spec, "Domain core"): pure code, no I/O, no framework.
 * `evaluate` is its single entry point: from the current instant, the
 * traveller's settings and the latest snapshot's train observations, it
 * generates the trips of the tracking horizon and ranks each leg's candidates.
 */
import { addDays, parisDate, type ParisDate } from '../utils/paris-time'
import type { LegKind, LocalTime, Route, TemplateLeg, TripTemplate, Weekday } from './trip-template'

/** How many days after today trips are tracked: the MAX JEUNE booking window (CONTEXT.md, Tracking Horizon). */
export const TRACKING_HORIZON_DAYS = 30

/** How many minutes outside the time window one step of route rank is worth, unless the traveller sets it (CONTEXT.md, Route Weight). */
export const DEFAULT_ROUTE_WEIGHT = 30

/** The largest route weight a traveller can set. */
export const MAX_ROUTE_WEIGHT = 120

/** The most trips a MAX JEUNE subscriber can hold at once (spec, "MAX JEUNE rules"). */
export const MAX_ACTIVE_BOOKINGS = 6

export interface TravellerSettings {
  template: TripTemplate
  /** Minutes per route rank when ranking out-of-window candidates; `DEFAULT_ROUTE_WEIGHT` when not set. */
  routeWeight?: number
  /** At most one per trip and leg. */
  bookings?: readonly Booking[]
}

/** A train the latest snapshot lists on a route and date, with whether it has an open MAX JEUNE seat. */
export interface TrainObservation extends Route {
  date: ParisDate
  trainNumber: string
  /** Paris time. An arrival earlier than the departure is on the next day. */
  departureTime: LocalTime
  arrivalTime: LocalTime
  open: boolean
}

/** A train as the traveller booked it, whether or not it still shows a seat. */
export type BookedTrain = Omit<TrainObservation, 'open'>

/** The train the traveller declared they reserved for a leg (CONTEXT.md, Booking). */
export interface Booking {
  /** The key of the booked leg's trip. */
  tripKey: string
  legKind: LegKind
  train: BookedTrain
}

export interface EvaluationInput {
  now: Date
  settings: TravellerSettings
  observations: readonly TrainObservation[]
}

/** A train with an open seat on one of a leg's routes, on the leg's date, in the latest snapshot. */
export interface Candidate {
  train: TrainObservation
  /** The rank of the train's route among the leg's routes; 1 is the most preferred. */
  routeRank: number
  /** Whether the train's time on the leg's anchor satisfies every bound of its time window. */
  inWindow: boolean
  /** How far the train's anchor time is outside the time window, 0 inside it. */
  minutesOutsideWindow: number
  /** How far the train's anchor time is from the ideal time. */
  minutesFromIdeal: number
  durationMinutes: number
}

/** A leg's booking, ranked with the same rules as its candidates. */
export interface RankedBooking extends Omit<Candidate, 'train' | 'routeRank'> {
  train: BookedTrain
  /** The rank of the booked train's route among the leg's routes; `null` once the route is no longer among them. */
  routeRank: number | null
  /** How many of the leg's candidates rank strictly above the booking: the first ones of the ranking. */
  candidatesAbove: number
}

/**
 * Where a leg stands:
 * - `booked`: the traveller holds a booking for it;
 * - `available`: its best candidate is inside the time window;
 * - `outside-window`: it only has candidates outside the time window;
 * - `none`: it has no candidate;
 * - `past`: its date has passed, while its trip is still tracked.
 */
export type LegStatus = 'booked' | 'available' | 'outside-window' | 'none' | 'past'

export interface Leg {
  kind: LegKind
  date: ParisDate
  /** The settings the leg is evaluated with: its time window, ideal time and ranked routes. */
  settings: TemplateLeg
  status: LegStatus
  /** In ranking order. */
  candidates: Candidate[]
  /** The top-ranked candidate, `null` when the leg has none. */
  best: Candidate | null
  booking: RankedBooking | null
}

export interface Trip {
  /** The ISO year-week of the trip's default outbound date, « 2026-W43 ». */
  key: string
  legs: Record<LegKind, Leg>
}

export interface Evaluation {
  /** The tracked trips, soonest first. */
  trips: Trip[]
  /** How many bookings are held for legs that have not passed, against `MAX_ACTIVE_BOOKINGS`. */
  activeBookings: number
}

export function evaluate({ now, settings, observations }: EvaluationInput): Evaluation {
  const today = parisDate(now)
  const horizonEnd = addDays(today, TRACKING_HORIZON_DAYS)
  const { outbound, return: returnLeg } = settings.template
  const returnOffset = (returnLeg.weekday - outbound.weekday + 7) % 7
  const routeWeight = settings.routeWeight ?? DEFAULT_ROUTE_WEIGHT
  const bookings = settings.bookings ?? []
  const bookingOf = (tripKey: string, kind: LegKind) =>
    bookings.find(booking => booking.tripKey === tripKey && booking.legKind === kind)?.train ?? null

  const trips: Trip[] = []
  // The template's outbound weekday in the week before today's, then every week after it.
  let outboundDate = addDays(today, outbound.weekday - weekday(today) - 7)
  for (; outboundDate <= horizonEnd; outboundDate = addDays(outboundDate, 7)) {
    const returnDate = addDays(outboundDate, returnOffset)
    if (returnDate < today) continue
    const key = isoWeek(outboundDate)
    trips.push({
      key,
      legs: {
        outbound: evaluateLeg('outbound', outboundDate, today, outbound, routeWeight, observations, bookingOf(key, 'outbound')),
        return: evaluateLeg('return', returnDate, today, returnLeg, routeWeight, observations, bookingOf(key, 'return')),
      },
    })
  }
  const activeBookings = bookings.filter(booking => booking.train.date >= today).length
  return { trips, activeBookings }
}

function evaluateLeg(
  kind: LegKind,
  date: ParisDate,
  today: ParisDate,
  templateLeg: TemplateLeg,
  routeWeight: number,
  observations: readonly TrainObservation[],
  bookedTrain: BookedTrain | null,
): Leg {
  if (date < today) {
    const booking = bookedTrain && rankedBooking(bookedTrain, date, templateLeg, [], routeWeight)
    return { kind, date, settings: templateLeg, status: 'past', candidates: [], best: null, booking }
  }

  const candidates: Candidate[] = []
  for (const train of observations) {
    if (!train.open || train.date !== date) continue
    const routeRank = routeRankOf(train, templateLeg)
    if (routeRank !== null) candidates.push({ train, routeRank, ...timeRanking(train, templateLeg) })
  }
  candidates.sort((a, b) => compareCandidates(a, b, routeWeight))
  const best = candidates[0] ?? null
  const booking = bookedTrain && rankedBooking(bookedTrain, date, templateLeg, candidates, routeWeight)

  let status: LegStatus = best === null ? 'none' : best.inWindow ? 'available' : 'outside-window'
  if (booking) status = 'booked'
  return { kind, date, settings: templateLeg, status, candidates, best, booking }
}

/** Whether two routes join the same origin and destination stations. */
export function sameRoute(a: Route, b: Route): boolean {
  return a.originCode === b.originCode && a.destinationCode === b.destinationCode
}

/** Whether two trains are the same train, on the same route and date. */
export function sameTrain(a: BookedTrain, b: BookedTrain): boolean {
  return a.date === b.date && a.trainNumber === b.trainNumber && sameRoute(a, b)
}

/** The rank of a train's route among a leg's routes, `null` when it is not one of them. */
export function routeRankOf(train: Route, { routes }: Pick<TemplateLeg, 'routes'>): number | null {
  const index = routes.findIndex(route => sameRoute(route, train))
  return index < 0 ? null : index + 1
}

/**
 * A booking ranked as if it were a candidate (spec, "Ranking rules"): the
 * candidates ranking strictly above it are the first ones of the ranking. A
 * booking that could no longer be a candidate of the leg, its route no longer
 * among the leg's routes or its train on another day, ranks below every candidate.
 */
function rankedBooking(train: BookedTrain, date: ParisDate, templateLeg: TemplateLeg, candidates: readonly Candidate[], routeWeight: number): RankedBooking {
  const routeRank = routeRankOf(train, templateLeg)
  const ranking = timeRanking(train, templateLeg)
  const candidatesAbove = routeRank === null || train.date !== date
    ? candidates.length
    : candidates.filter(candidate => compareCandidates(candidate, { routeRank, ...ranking, train }, routeWeight) < 0).length
  return { train, routeRank, ...ranking, candidatesAbove }
}

/** What the ranking reads of a train's times: against the leg's window and ideal time. */
type TimeRanking = Pick<Candidate, 'inWindow' | 'minutesOutsideWindow' | 'minutesFromIdeal' | 'durationMinutes'>

function timeRanking(train: BookedTrain, { anchor, window, idealTime }: TemplateLeg): TimeRanking {
  const departure = minutes(train.departureTime)
  let arrival = minutes(train.arrivalTime)
  // An arrival earlier than the departure is on the next day.
  if (arrival < departure) arrival += MINUTES_PER_DAY
  const anchorTime = anchor === 'departure' ? departure : arrival

  const start = window.start === null ? null : minutes(window.start)
  const end = window.end === null ? null : minutes(window.end)
  let minutesOutsideWindow = 0
  if (start !== null && anchorTime < start) minutesOutsideWindow = start - anchorTime
  else if (end !== null && anchorTime > end) minutesOutsideWindow = anchorTime - end

  return {
    inWindow: minutesOutsideWindow === 0,
    minutesOutsideWindow,
    minutesFromIdeal: Math.abs(anchorTime - minutes(idealTime)),
    durationMinutes: arrival - departure,
  }
}

/** A candidate, or a booking whose route is among the leg's routes. */
type Ranked = Omit<Candidate, 'train'> & { train: BookedTrain }

/**
 * The ranking (spec, "Ranking rules"): in-window candidates first, by route
 * rank, then closeness to the ideal time, then earlier departure; then
 * out-of-window candidates, by minutes outside the window plus the route
 * weight for each rank below 1, then route rank, then earlier departure.
 */
function compareCandidates(a: Ranked, b: Ranked, routeWeight: number): number {
  if (a.inWindow !== b.inWindow) return a.inWindow ? -1 : 1
  const difference = a.inWindow
    ? compareKeys([a.routeRank, a.minutesFromIdeal], [b.routeRank, b.minutesFromIdeal])
    : compareOutOfWindow(a, b, routeWeight)
  return difference || minutes(a.train.departureTime) - minutes(b.train.departureTime)
}

type OutOfWindowRanking = Pick<Candidate, 'minutesOutsideWindow' | 'routeRank'>

/**
 * How two out-of-window candidates rank, before the departure time breaks a
 * tie: by minutes outside the time window plus the route weight for each route
 * rank below 1, then by route rank. Negative when `a` ranks first.
 */
export function compareOutOfWindow(a: OutOfWindowRanking, b: OutOfWindowRanking, routeWeight: number): number {
  const cost = ({ minutesOutsideWindow, routeRank }: OutOfWindowRanking) => minutesOutsideWindow + routeWeight * (routeRank - 1)
  return compareKeys([cost(a), a.routeRank], [cost(b), b.routeRank])
}

/** Compares two lists of ranking keys, the first key first. */
function compareKeys(aKeys: readonly number[], bKeys: readonly number[]): number {
  for (const [index, aKey] of aKeys.entries()) {
    const difference = aKey - bKeys[index]!
    if (difference !== 0) return difference
  }
  return 0
}

const MINUTES_PER_DAY = 24 * 60

/** The minutes since midnight of « HH:MM ». */
function minutes(time: LocalTime): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours! * 60 + mins!
}

/** The ISO weekday of a calendar day. */
function weekday(date: ParisDate): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

/** « 2026-W43 »: the ISO year and week of a calendar day. */
function isoWeek(date: ParisDate): string {
  // The ISO week is the week of its Thursday, and its year is that Thursday's.
  const thursday = new Date(`${addDays(date, 4 - weekday(date))}T00:00:00Z`)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * 24 * 3600 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}
