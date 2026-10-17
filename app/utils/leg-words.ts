import type { LegKind, LegSettings, Route, TimeAnchor, Weekday } from '#shared/domain/trip-template'

export { LEG_KINDS } from '#shared/domain/trip-template'

export const LEG_NAMES: Record<LegKind, string> = { outbound: 'Aller', return: 'Retour' }

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
}

/**
 * How a leg's anchor reads: « Arriver avant 10:00 », « Arrivée acceptée
 * jusqu’à 10:00 · idéale 09:00 », « Arrivée idéale ».
 */
export const ANCHOR_WORDS: Record<TimeAnchor, { verb: string, accepted: string, ideal: string, idealAdjective: string }> = {
  departure: { verb: 'Partir', accepted: 'Départ accepté', ideal: 'Départ idéal', idealAdjective: 'idéal' },
  arrival: { verb: 'Arriver', accepted: 'Arrivée acceptée', ideal: 'Arrivée idéale', idealAdjective: 'idéale' },
}

/** Monday first, as on a French calendar. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly Weekday[]

/** A day a leg can run on, as the leg editor offers it: a weekday or a date. */
export interface DayChoice<Day> {
  value: Day
  /** In full, for assistive technologies: « Jeudi », « Jeudi 22 octobre ». */
  label: string
  /** On the day chip: « Jeu ». */
  short: string
  /** Under it, for a date: « 22 ». */
  detail?: string
}

/** The days of the week, for a leg of the trip template. */
export const WEEKDAY_CHOICES: readonly DayChoice<Weekday>[] = WEEKDAYS.map(weekday => ({
  value: weekday,
  label: WEEKDAY_NAMES[weekday],
  short: WEEKDAY_NAMES[weekday].slice(0, 3),
}))

/** « Paris Gare de Lyon → Lyon Part-Dieu ». */
export function routeName(route: Route, stationName: (code: string) => string): string {
  return `${stationName(route.originCode)} → ${stationName(route.destinationCode)}`
}

/**
 * A leg's time window as the ticket shows it: a label (« Arriver avant ») over
 * a time in large type (« 10:00 »).
 */
export function windowHeadline({ anchor, window }: LegSettings): { label: string, time: string } {
  const { verb } = ANCHOR_WORDS[anchor]
  if (window.start && window.end) return { label: `${verb} entre`, time: `${window.start} – ${window.end}` }
  if (window.end) return { label: `${verb} avant`, time: window.end }
  if (window.start) return { label: `${verb} après`, time: window.start }
  return { label: verb, time: 'À toute heure' }
}

/** The caption of a leg's day bar: « Arrivée acceptée jusqu’à 10:00 · idéale 09:00 ». */
export function windowCaption({ anchor, window, idealTime }: LegSettings): string {
  const { accepted, idealAdjective } = ANCHOR_WORDS[anchor]
  let range = 'à toute heure'
  if (window.start && window.end) range = `de ${window.start} à ${window.end}`
  else if (window.end) range = `jusqu’à ${window.end}`
  else if (window.start) range = `à partir de ${window.start}`
  return `${accepted} ${range} · ${idealAdjective} ${idealTime}`
}
