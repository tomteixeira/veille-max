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

export interface TravellerSettings {
  template: TripTemplate
  /** Minutes per route rank when ranking out-of-window candidates; `DEFAULT_ROUTE_WEIGHT` when not set. */
  routeWeight?: number
  /** The customised trips, by trip key. */
  customisations?: Readonly<Record<string, TripCustomisation>>
  mutes?: readonly TripMute[]
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

/**
 * Where a leg stands:
 * - `available`: its best candidate is inside the time window;
 * - `outside-window`: it only has candidates outside the time window;
 * - `none`: it has no candidate;
 * - `past`: its date has passed, while its trip is still tracked.
 */
export type LegStatus = 'available' | 'outside-window' | 'none' | 'past'

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

export interface Evaluation {
  /** The tracked trips, soonest first. Trips whose legs have all passed are archived: left out. */
  trips: Trip[]
  /** The next trips beyond the tracking horizon, soonest first. */
  upcoming: UpcomingTrip[]
}

export function evaluate({ now, settings, observations }: EvaluationInput): Evaluation {
  const today = parisDate(now)
  const horizonEnd = addDays(today, TRACKING_HORIZON_DAYS)
  const { template, customisations = {}, mutes = [] } = settings
  const returnOffset = (template.return.weekday - template.outbound.weekday + 7) % 7
  const routeWeight = settings.routeWeight ?? DEFAULT_ROUTE_WEIGHT
  const isMuted = (tripKey: string, leg?: LegKind) => mutes.some(mute => mute.tripKey === tripKey && mute.leg === leg)

  const trips: Trip[] = []
  const upcoming: UpcomingTrip[] = []
  // The template's outbound weekday two weeks before today's, so that a trip
  // whose return leg was moved later is still found, then every week after it.
  let outboundDate = addDays(today, template.outbound.weekday - weekday(today) - 14)
  for (; upcoming.length < UPCOMING_TRIP_COUNT; outboundDate = addDays(outboundDate, 7)) {
    const key = isoWeek(outboundDate)
    const customisation = customisations[key]
    const legs = customisation ?? {
      outbound: { ...legSettings(template.outbound), date: outboundDate },
      return: { ...legSettings(template.return), date: addDays(outboundDate, returnOffset) },
    }
    const [firstDate, lastDate] = [legs.outbound.date, legs.return.date].sort() as [ParisDate, ParisDate]
    // Archived once every leg has passed.
    if (lastDate < today) continue

    const muted = isMuted(key)
    const evaluated = (kind: LegKind) => evaluateLeg(kind, legs[kind], muted || isMuted(key, kind), today, routeWeight, observations)
    const trip: Trip = { key, customised: customisation !== undefined, muted, legs: { outbound: evaluated('outbound'), return: evaluated('return') } }

    // Tracked as soon as its first leg enters the horizon.
    if (firstDate <= horizonEnd) trips.push(trip)
    else upcoming.push({ ...trip, opensOn: addDays(firstDate, -TRACKING_HORIZON_DAYS) })
  }
  // Customised dates can put a trip before the one of the previous week.
  const soonestFirst = (a: Trip, b: Trip) => firstLegDate(a).localeCompare(firstLegDate(b))
  return { trips: trips.sort(soonestFirst), upcoming: upcoming.sort(soonestFirst) }
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

function evaluateLeg(kind: LegKind, leg: CustomisedLeg, muted: boolean, today: ParisDate, routeWeight: number, observations: readonly TrainObservation[]): Leg {
  const { date } = leg
  const settings = legSettings(leg)
  if (date < today) return { kind, date, settings, muted, status: 'past', candidates: [], best: null }

  const candidates: Candidate[] = []
  for (const train of observations) {
    if (!train.open || train.date !== date) continue
    const routeIndex = settings.routes.findIndex(route => route.originCode === train.originCode && route.destinationCode === train.destinationCode)
    if (routeIndex >= 0) candidates.push(rankedCandidate(train, routeIndex + 1, settings))
  }
  candidates.sort((a, b) => compareCandidates(a, b, routeWeight))
  const best = candidates[0] ?? null
  const status = best === null ? 'none' : best.inWindow ? 'available' : 'outside-window'
  return { kind, date, settings, muted, status, candidates, best }
}

/** A candidate with what the ranking reads of it: its time against the leg's window and ideal time. */
function rankedCandidate(train: TrainObservation, routeRank: number, { anchor, window, idealTime }: LegSettings): Candidate {
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
    train,
    routeRank,
    inWindow: minutesOutsideWindow === 0,
    minutesOutsideWindow,
    minutesFromIdeal: Math.abs(anchorTime - minutes(idealTime)),
    durationMinutes: arrival - departure,
  }
}

/**
 * The ranking (spec, "Ranking rules"): in-window candidates first, by route
 * rank, then closeness to the ideal time, then earlier departure; then
 * out-of-window candidates, by minutes outside the window plus the route
 * weight for each rank below 1, then route rank, then earlier departure.
 */
function compareCandidates(a: Candidate, b: Candidate, routeWeight: number): number {
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
