import type { LegStatus, Trip } from '#shared/domain/evaluation'
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
