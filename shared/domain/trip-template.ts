/**
 * The Trip Template (CONTEXT.md): the default settings of a trip's two legs,
 * from which every trip in the tracking horizon is generated.
 */

/** The Outbound leg (« Aller ») or the Return leg (« Retour »). */
export type LegKind = 'outbound' | 'return'

/** The legs in the order a trip runs them. */
export const LEG_KINDS = ['outbound', 'return'] as const satisfies readonly LegKind[]

export function isLegKind(value: string): value is LegKind {
  return (LEG_KINDS as readonly string[]).includes(value)
}

/** ISO weekday: 1 is Monday, 7 is Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Whether a leg's time window and ideal time apply to the departure or to the arrival. */
export type TimeAnchor = 'departure' | 'arrival'

/** A time of day in Paris, « HH:MM ». */
export type LocalTime = string

/** A station of the `tgvmax` dataset: its 5-character SNCF code and its full name. */
export interface Station {
  code: string
  name: string
}

/** An ordered origin station → destination station pair, by 5-character SNCF code. */
export interface Route {
  originCode: string
  destinationCode: string
}

/**
 * The preferred time range of a leg, on its anchor. Both bounds are optional:
 * the window is « on or after `start` » and « on or before `end` ».
 */
export interface TimeWindow {
  start: LocalTime | null
  end: LocalTime | null
}

export interface TemplateLeg {
  weekday: Weekday
  anchor: TimeAnchor
  window: TimeWindow
  idealTime: LocalTime
  /** Ranked: the first route has rank 1, the most preferred. */
  routes: readonly Route[]
}

export type TripTemplate = Record<LegKind, TemplateLeg>

/** The trip template of a traveller who has not configured one yet. */
export function defaultTripTemplate(): TripTemplate {
  return {
    outbound: { weekday: 5, anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [] },
    return: { weekday: 7, anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [] },
  }
}

/**
 * Why a route cannot be added to a leg's ranked routes:
 * - `same-station`: its origin is its destination;
 * - `already-ranked`: the leg already ranks it.
 */
export type RouteProblem = 'same-station' | 'already-ranked'

/** Why `route` cannot be added to a leg's ranked `routes`, or `null` when it can. */
export function routeProblem(routes: readonly Route[], route: Route): RouteProblem | null {
  if (route.originCode === route.destinationCode) return 'same-station'
  const ranked = routes.some(({ originCode, destinationCode }) =>
    originCode === route.originCode && destinationCode === route.destinationCode)
  return ranked ? 'already-ranked' : null
}

/** A leg's ranked `routes` with `route` ranked last. Check `routeProblem` first. */
export function addRoute(routes: readonly Route[], route: Route): Route[] {
  const problem = routeProblem(routes, route)
  if (problem) throw new Error(`Cannot add ${route.originCode} → ${route.destinationCode}: ${problem}`)
  return [...routes, route]
}

/** A leg's ranked `routes` with the route of rank `rank` swapped with its neighbour above or below, when it has one. */
export function moveRoute(routes: readonly Route[], rank: number, direction: 'up' | 'down'): Route[] {
  const from = rank - 1
  const to = direction === 'up' ? from - 1 : from + 1
  const moving = routes[from]
  const neighbour = routes[to]
  const moved = [...routes]
  if (!moving || !neighbour) return moved

  moved[to] = moving
  moved[from] = neighbour
  return moved
}

/** A leg's ranked `routes` without the route of rank `rank`; the routes below it move up one rank. */
export function removeRoute(routes: readonly Route[], rank: number): Route[] {
  return routes.filter((_, index) => index !== rank - 1)
}
