import type { Candidate, Leg, LegStatus, Trip } from '#shared/domain/evaluation'
import type { TemplateLeg } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'

/** The chip of a leg on its ticket half. */
export const LEG_STATUS_NAMES: Record<LegStatus, string> = {
  'available': 'Disponible',
  'outside-window': 'Hors fenêtre',
  'none': 'Rien pour l’instant',
  'past': 'Passé',
}

// Calendar days are formatted at UTC midnight, where they never shift.
const dayAndMonth = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const day = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric' })
const shortWeekday = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short' })
const longDay = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

function utcMidnight(date: ParisDate): Date {
  return new Date(`${date}T00:00:00Z`)
}

/** « 23 – 25 oct. », « 30 oct. – 1 nov. »: the days a trip spans. */
export function tripTitle({ legs }: Trip): string {
  const outbound = utcMidnight(legs.outbound.date)
  const returnDate = utcMidnight(legs.return.date)
  if (legs.outbound.date === legs.return.date) return dayAndMonth.format(outbound)
  const sameMonth = legs.outbound.date.slice(0, 7) === legs.return.date.slice(0, 7)
  return `${sameMonth ? day.format(outbound) : dayAndMonth.format(outbound)} – ${dayAndMonth.format(returnDate)}`
}

/** « Ven 23 »: a leg's day on its ticket half. */
export function shortDay(date: ParisDate): string {
  const weekday = shortWeekday.format(utcMidnight(date)).replace('.', '')
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day.format(utcMidnight(date))}`
}

/** « 1 h 56 », « 45 min »: how long a train takes. */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** « Vendredi 23 octobre »: a leg's day on its leg view. */
export function longDayName(date: ParisDate): string {
  const text = longDay.format(utcMidnight(date))
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** « 3 trains disponibles »: the headline of a leg view. */
export function legHeadline({ status, candidates }: Leg): string {
  if (status === 'past') return 'Ce jour est passé'
  if (candidates.length === 0) return 'Aucun train pour l’instant'
  return `${candidates.length} train${candidates.length > 1 ? 's' : ''} disponible${candidates.length > 1 ? 's' : ''}`
}

/** The window banner of a leg view: « Arrivée avant 10:00 », « idéale 09:00 ». */
export function windowBanner({ anchor, window, idealTime }: TemplateLeg): { window: string, ideal: string } {
  const noun = anchor === 'departure' ? 'Départ' : 'Arrivée'
  let range = 'à toute heure'
  if (window.start && window.end) range = `entre ${window.start} et ${window.end}`
  else if (window.end) range = `avant ${window.end}`
  else if (window.start) range = `après ${window.start}`
  return { window: `${noun} ${range}`, ideal: `${ANCHOR_WORDS[anchor].idealAdjective} ${idealTime}` }
}

/**
 * Why a candidate ranks where it does: « Pile à l’heure idéale », « À 30 min
 * de l’heure idéale », « 1 h 00 hors fenêtre », « 25 min hors fenêtre + 2 rangs × 30 min ».
 */
export function rankExplanation({ inWindow, minutesFromIdeal, minutesOutsideWindow, routeRank }: Candidate, routeWeight: number): string {
  if (!inWindow) {
    const outside = `${durationText(minutesOutsideWindow)} hors fenêtre`
    const ranksBelow = routeRank - 1
    if (ranksBelow === 0 || routeWeight === 0) return outside
    return `${outside} + ${ranksBelow} rang${ranksBelow > 1 ? 's' : ''} × ${routeWeight} min`
  }
  if (minutesFromIdeal === 0) return 'Pile à l’heure idéale'
  return `À ${durationText(minutesFromIdeal)} de l’heure idéale`
}
