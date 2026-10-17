/**
 * The domain core (spec, "Domain core"): pure code, no I/O, no framework.
 * `evaluate` is its single entry point: from the current instant, the
 * traveller's settings and the latest snapshot's train observations, it
 * generates the trips of the tracking horizon and ranks each leg's candidates.
 */
import { addDays, parisDate, type ParisDate } from '../utils/paris-time'
import type { LegKind, LegSettings, LocalTime, Route, TripTemplate, Weekday } from './trip-template'

/** How many days after today trips are tracked: the MAX JEUNE booking window (CONTEXT.md, Tracking Horizon). */
export const TRACKING_HORIZON_DAYS = 30

/** How many minutes outside the time window one step of route rank is worth, unless the traveller sets it (CONTEXT.md, Route Weight). */
export const DEFAULT_ROUTE_WEIGHT = 30

/** How many trips beyond the tracking horizon are shown in advance (CONTEXT.md, Upcoming Trip). */
export const UPCOMING_TRIP_COUNT = 2

/** A leg of a customised trip: its own settings, on its own date. */
export interface CustomisedLeg extends LegSettings {
  date: ParisDate
}

/** The leg settings of a customised trip, detached from the trip template (CONTEXT.md, Customised Trip). */
export type TripCustomisation = Record<LegKind, CustomisedLeg>

/** A muted trip, or only one of its legs when `leg` is set (CONTEXT.md, Muted). */
export interface TripMute {
  tripKey: string
  leg?: LegKind
}

/** The largest route weight a traveller can set. */
export const MAX_ROUTE_WEIGHT = 120

/** The most trips a MAX JEUNE subscriber can hold at once (spec, "MAX JEUNE rules"). */
export const MAX_ACTIVE_BOOKINGS = 6

export interface TravellerSettings {
  template: TripTemplate
  /** Minutes per route rank when ranking out-of-window candidates; `DEFAULT_ROUTE_WEIGHT` when not set. */
  routeWeight?: number
  /** The customised trips, by trip key. */
  customisations?: Readonly<Record<string, TripCustomisation>>
  mutes?: readonly TripMute[]
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

/** A leg's reference best candidate, as the previous evaluation left it (CONTEXT.md, Improvement). */
export interface LegReference {
  tripKey: string
  legKind: LegKind
  /** What ranked the leg then: its date, settings and the route weight. A reference ranked otherwise is stale. */
  rankingKey: string
  /** The leg's best candidate then, `null` when it had none. */
  train: BookedTrain | null
}

export interface EvaluationInput {
  now: Date
  settings: TravellerSettings
  observations: readonly TrainObservation[]
  /**
   * The references stored after the previous snapshot. A leg without one is
   * told its first candidate; a leg whose settings changed since its
   * reference was stored is told nothing, as after a reset.
   */
  references?: readonly LegReference[]
  /**
   * The first day of the archived trips to return: those whose legs have all
   * passed, one of them on or after that day. None when it is not set.
   */
  archivedSince?: ParisDate
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
  /** The settings the leg is evaluated with: the trip template's, or the customised trip's. */
  settings: LegSettings
  /** Whether the leg or its whole trip is muted: still evaluated, but never notified. */
  muted: boolean
  status: LegStatus
  /** In ranking order. */
  candidates: Candidate[]
  /** The top-ranked candidate, `null` when the leg has none. */
  best: Candidate | null
  booking: RankedBooking | null
}

export interface Trip {
  /** The ISO year-week of the trip's default outbound date, « 2026-W43 ». It does not change when its dates are customised. */
  key: string
  /** Whether the trip's leg settings are its own, rather than the trip template's. */
  customised: boolean
  /** Whether the whole trip is muted. */
  muted: boolean
  legs: Record<LegKind, Leg>
}

/** A trip just beyond the tracking horizon, shown in advance. */
export interface UpcomingTrip extends Trip {
  /** The day the trip enters the tracking horizon, when its seats can start coming out. */
  opensOn: ParisDate
}

/**
 * Why a leg's new best candidate is worth a notification:
 * - `first-candidate`: the leg had no candidate, no reference and no booking;
 * - `new-best`: it ranks strictly above the previous best candidate, itself above the booking if any;
 * - `better-than-booking`: it ranks strictly above the booking, which was the reference.
 */
export type ImprovementKind = 'first-candidate' | 'new-best' | 'better-than-booking'

/** A leg whose best candidate ranks strictly above its reference (CONTEXT.md, Improvement). */
export interface Improvement {
  tripKey: string
  legKind: LegKind
  date: ParisDate
  kind: ImprovementKind
  /** The leg's new best candidate. */
  candidate: Candidate
}

export interface Evaluation {
  /** The tracked trips, soonest first. Trips whose legs have all passed are archived: left out. */
  trips: Trip[]
  /** The next trips beyond the tracking horizon, soonest first. */
  upcoming: UpcomingTrip[]
  /** The trips whose legs have all passed, since `EvaluationInput.archivedSince`, soonest first: kept, never notified. */
  archived: Trip[]
  /** How many bookings are held for legs that have not passed, against `MAX_ACTIVE_BOOKINGS`. */
  activeBookings: number
  /** The new reference of every tracked leg that has not passed, muted or not: its best candidate now. */
  references: LegReference[]
  /**
   * The new references of the legs whose stored reference is missing or was
   * ranked with other settings: those a settings change resets, without
   * notifying (spec, "Settings writes"). The other legs keep theirs.
   */
  resets: LegReference[]
  /** The improvements to notify, against `EvaluationInput.references`: never on a muted leg. */
  improvements: Improvement[]
}

export function evaluate({ now, settings, observations, references: previousReferences = [], archivedSince }: EvaluationInput): Evaluation {
  const today = parisDate(now)
  const horizonEnd = addDays(today, TRACKING_HORIZON_DAYS)
  const { template, customisations = {}, mutes = [] } = settings
  const returnOffset = (template.return.weekday - template.outbound.weekday + 7) % 7
  const routeWeight = settings.routeWeight ?? DEFAULT_ROUTE_WEIGHT
  const isMuted = (tripKey: string, leg?: LegKind) => mutes.some(mute => mute.tripKey === tripKey && mute.leg === leg)
  const bookings = settings.bookings ?? []
  const bookingOf = (tripKey: string, kind: LegKind) =>
    bookings.find(booking => booking.tripKey === tripKey && booking.legKind === kind)?.train ?? null

  const previousReference = (tripKey: string, kind: LegKind) =>
    previousReferences.find(reference => reference.tripKey === tripKey && reference.legKind === kind)

  const trips: Trip[] = []
  const upcoming: UpcomingTrip[] = []
  const archived: Trip[] = []
  const references: LegReference[] = []
  const resets: LegReference[] = []
  const improvements: Improvement[] = []
  // The template's outbound weekday two weeks before today's, so that a trip
  // whose return leg was moved later is still found, then every week after it.
  // A week before the first archived day's for archived trips, for the same reason.
  const firstWeek = (day: ParisDate, weeksBefore: number) => addDays(day, template.outbound.weekday - weekday(day) - 7 * weeksBefore)
  let outboundDate = firstWeek(today, 2)
  if (archivedSince !== undefined && archivedSince < today) outboundDate = [outboundDate, firstWeek(archivedSince, 1)].sort()[0]!
  for (; upcoming.length < UPCOMING_TRIP_COUNT; outboundDate = addDays(outboundDate, 7)) {
    const key = isoWeek(outboundDate)
    const customisation = customisations[key]
    const legs = customisation ?? {
      outbound: { ...legSettings(template.outbound), date: outboundDate },
      return: { ...legSettings(template.return), date: addDays(outboundDate, returnOffset) },
    }
    const [firstDate, lastDate] = [legs.outbound.date, legs.return.date].sort() as [ParisDate, ParisDate]
    const muted = isMuted(key)
    const evaluated = (kind: LegKind) => evaluateLeg(kind, legs[kind], muted || isMuted(key, kind), today, routeWeight, observations, bookingOf(key, kind))
    const trip: Trip = { key, customised: customisation !== undefined, muted, legs: { outbound: evaluated('outbound'), return: evaluated('return') } }

    // Archived once every leg has passed.
    if (lastDate < today) {
      if (archivedSince !== undefined && lastDate >= archivedSince) archived.push(trip)
      continue
    }

    // Tracked as soon as its first leg enters the horizon.
    if (firstDate > horizonEnd) {
      upcoming.push({ ...trip, opensOn: addDays(firstDate, -TRACKING_HORIZON_DAYS) })
      continue
    }
    trips.push(trip)
    for (const leg of Object.values(trip.legs)) {
      if (leg.status === 'past') continue
      const reference = { tripKey: key, legKind: leg.kind, rankingKey: rankingKey(leg, routeWeight), train: leg.best && bookedTrain(leg.best.train) }
      references.push(reference)
      const previous = previousReference(key, leg.kind)
      const stale = previous !== undefined && previous.rankingKey !== reference.rankingKey
      if (!previous || stale) resets.push(reference)
      // Ranked with other settings, as when a reset failed: replaced without notifying.
      if (stale) continue
      const kind = improvementKind(leg, previous?.train ?? null, routeWeight)
      // Muted legs keep their reference up to date, but are never notified.
      if (kind && !leg.muted) improvements.push({ tripKey: key, legKind: leg.kind, date: leg.date, kind, candidate: leg.best! })
    }
  }
  // Customised dates can put a trip before the one of the previous week.
  const soonestFirst = (a: Trip, b: Trip) => firstLegDate(a).localeCompare(firstLegDate(b))
  const activeBookings = bookings.filter(booking => isActiveBooking(booking, today)).length
  return { trips: trips.sort(soonestFirst), upcoming: upcoming.sort(soonestFirst), archived: archived.sort(soonestFirst), activeBookings, references, resets, improvements }
}

/** What ranks a leg's candidates: its date, anchor, window, ideal time and ranked routes, and the route weight. */
function rankingKey({ date, settings: { anchor, window, idealTime, routes } }: Leg, routeWeight: number): string {
  const routeCodes = routes.map(route => `${route.originCode}>${route.destinationCode}`)
  return JSON.stringify([date, anchor, window.start, window.end, idealTime, routeCodes, routeWeight])
}

/** A train without whether it has a seat. */
function bookedTrain({ open: _open, ...train }: TrainObservation): BookedTrain {
  return train
}

/**
 * Whether a leg's best candidate improves on its reference (spec, "Ranking
 * rules"): the better of the previous best candidate and the booking. A leg
 * with neither is improved by its first candidate.
 */
function improvementKind({ date, settings, best, booking }: Leg, previous: BookedTrain | null, routeWeight: number): ImprovementKind | null {
  if (!best) return null
  if (!previous && !booking) return 'first-candidate'

  const compare = (a: BookedTrain, b: BookedTrain) => compareTrains(a, b, date, settings, routeWeight)
  if (booking && compare(best.train, booking.train) >= 0) return null
  if (previous && compare(best.train, previous) >= 0) return null
  // The booking is the reference unless the previous best candidate ranks strictly above it.
  return booking && !(previous && compare(previous, booking.train) < 0) ? 'better-than-booking' : 'new-best'
}

function firstLegDate({ legs }: Trip): ParisDate {
  return legs.outbound.date < legs.return.date ? legs.outbound.date : legs.return.date
}

/**
 * The customisation of `trip` once the traveller applies `change` to its
 * `kind` leg: everything else keeps its current settings, so the first change
 * copies the trip template's settings of both legs into the trip.
 */
export function customiseTrip(trip: Trip, kind: LegKind, change: Partial<CustomisedLeg>): TripCustomisation {
  const current = ({ settings, date }: Leg): CustomisedLeg => ({ ...settings, date })
  const customisation = { outbound: current(trip.legs.outbound), return: current(trip.legs.return) }
  return { ...customisation, [kind]: { ...customisation[kind], ...change } }
}

/** How many days before its week's Monday, and after its Sunday, a trip's legs can move. */
const LEG_DATE_MARGIN_DAYS = 3

/**
 * The dates the `kind` leg of `trip` can move to: for the outbound leg, the
 * week up to the return leg's date; for the return leg, the week from the
 * outbound leg's date. Either way, the trip never comes back before it leaves,
 * its legs stay within three days of its week, so it never drifts into another
 * trip's, and no leg moves to a day that has passed at `now`.
 */
export function legDateChoices(trip: Trip, kind: LegKind, now: Date): ParisDate[] {
  const today = parisDate(now)
  const monday = isoWeekMonday(trip.key)
  const [first, last] = [addDays(monday, -LEG_DATE_MARGIN_DAYS), addDays(monday, 6 + LEG_DATE_MARGIN_DAYS)]
  const week = [0, 1, 2, 3, 4, 5, 6]
  const choices = kind === 'outbound'
    ? week.map(day => addDays(trip.legs.return.date, day - 6))
    : week.map(day => addDays(trip.legs.outbound.date, day))
  return choices.filter(date => date >= first && date <= last && (date >= today || date === trip.legs[kind].date))
}

/** Only the settings of a leg, without its weekday or date. */
function legSettings({ anchor, window, idealTime, routes }: LegSettings): LegSettings {
  return { anchor, window, idealTime, routes }
}

function evaluateLeg(
  kind: LegKind,
  leg: CustomisedLeg,
  muted: boolean,
  today: ParisDate,
  routeWeight: number,
  observations: readonly TrainObservation[],
  bookedTrain: BookedTrain | null,
): Leg {
  const { date } = leg
  const settings = legSettings(leg)
  if (date < today) {
    const booking = bookedTrain && rankedBooking(bookedTrain, date, settings, [], routeWeight)
    return { kind, date, settings, muted, status: 'past', candidates: [], best: null, booking }
  }

  const candidates = rankCandidates(observations, date, settings, routeWeight)
  const best = candidates[0] ?? null
  const booking = bookedTrain && rankedBooking(bookedTrain, date, settings, candidates, routeWeight)

  let status: LegStatus = best === null ? 'none' : best.inWindow ? 'available' : 'outside-window'
  if (booking) status = 'booked'
  return { kind, date, settings, muted, status, candidates, best, booking }
}

/**
 * The candidates of a leg on `date` among `observations`, in ranking order:
 * the trains with an open seat on one of its routes, on that date.
 */
export function rankCandidates(observations: readonly TrainObservation[], date: ParisDate, settings: LegSettings, routeWeight: number): Candidate[] {
  const candidates: Candidate[] = []
  for (const train of observations) {
    if (!train.open || train.date !== date) continue
    const routeRank = routeRankOf(train, settings)
    if (routeRank !== null) candidates.push({ train, routeRank, ...timeRanking(train, settings) })
  }
  return candidates.sort((a, b) => compareCandidates(a, b, routeWeight))
}

/** Whether a booking counts against `MAX_ACTIVE_BOOKINGS` on `today`: until its leg has passed. */
export function isActiveBooking({ train }: Booking, today: ParisDate): boolean {
  return train.date >= today
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
export function routeRankOf(train: Route, { routes }: Pick<LegSettings, 'routes'>): number | null {
  const index = routes.findIndex(route => sameRoute(route, train))
  return index < 0 ? null : index + 1
}

/**
 * A booking ranked as if it were a candidate (spec, "Ranking rules"): the
 * candidates ranking strictly above it are the first ones of the ranking. A
 * booking that could no longer be a candidate of the leg, its route no longer
 * among the leg's routes or its train on another day, ranks below every candidate.
 */
function rankedBooking(train: BookedTrain, date: ParisDate, settings: LegSettings, candidates: readonly Candidate[], routeWeight: number): RankedBooking {
  const ranked = rankedTrain(train, date, settings)
  const candidatesAbove = ranked === null
    ? candidates.length
    : candidates.filter(candidate => compareCandidates(candidate, ranked, routeWeight) < 0).length
  return { train, routeRank: routeRankOf(train, settings), ...timeRanking(train, settings), candidatesAbove }
}

/** A train ranked as a candidate of a leg, `null` when it could not be one: its route is not among the leg's, or it runs on another day. */
function rankedTrain(train: BookedTrain, date: ParisDate, settings: LegSettings): Ranked | null {
  const routeRank = routeRankOf(train, settings)
  if (routeRank === null || train.date !== date) return null
  return { train, routeRank, ...timeRanking(train, settings) }
}

/**
 * How two trains rank as candidates of a leg, whether or not they have a seat:
 * negative when `a` ranks first. A train that could not be a candidate ranks
 * below every one that could.
 */
function compareTrains(a: BookedTrain, b: BookedTrain, date: ParisDate, settings: LegSettings, routeWeight: number): number {
  const [rankedA, rankedB] = [rankedTrain(a, date, settings), rankedTrain(b, date, settings)]
  if (!rankedA || !rankedB) return Number(!rankedA) - Number(!rankedB)
  return compareCandidates(rankedA, rankedB, routeWeight)
}

/** What the ranking reads of a train's times: against the leg's window and ideal time. */
type TimeRanking = Pick<Candidate, 'inWindow' | 'minutesOutsideWindow' | 'minutesFromIdeal' | 'durationMinutes'>

function timeRanking(train: BookedTrain, { anchor, window, idealTime }: LegSettings): TimeRanking {
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

/** The Monday of « 2026-W43 »'s week. */
function isoWeekMonday(key: string): ParisDate {
  const [year, week] = key.split('-W').map(Number)
  // 4 January is always in week 1.
  const january4 = `${year}-01-04`
  return addDays(january4, (week! - 1) * 7 - (weekday(january4) - 1))
}
