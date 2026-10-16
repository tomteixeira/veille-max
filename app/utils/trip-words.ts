import type { Candidate, Leg, LegStatus, RankedBooking, Trip } from '#shared/domain/evaluation'
import type { LegSettings } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'
import type { DayChoice } from './leg-words'

/** The chip of a leg on its ticket half. */
export const LEG_STATUS_NAMES: Record<LegStatus, string> = {
  'booked': 'Réservé',
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

const dayAndMonthDigits = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })

/** « Ouverture le 21/10 »: when an upcoming trip enters the tracking horizon. */
export function opensOnText(date: ParisDate): string {
  return `Ouverture le ${dayAndMonthDigits.format(utcMidnight(date))}`
}

/** The dates a leg of a trip can move to, as the leg editor offers them: « Jeu » over « 22 ». */
export function dateChoices(dates: readonly ParisDate[]): DayChoice<ParisDate>[] {
  return dates.map((date) => {
    const weekday = shortWeekday.format(utcMidnight(date)).replace('.', '')
    return { value: date, label: longDayName(date), short: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`, detail: day.format(utcMidnight(date)) }
  })
}

/** The chip of a leg on its ticket half: « En sourdine » when it is muted, its status otherwise. */
export function legChip({ muted, status }: Leg): string {
  return muted ? 'En sourdine' : LEG_STATUS_NAMES[status]
}

/** « 3 trains disponibles »: the headline of a leg view. */
export function legHeadline({ status, candidates }: Leg): string {
  if (status === 'past') return 'Ce jour est passé'
  if (candidates.length === 0) return 'Aucun train pour l’instant'
  return `${candidates.length} train${candidates.length > 1 ? 's' : ''} disponible${candidates.length > 1 ? 's' : ''}`
}

/** The window banner of a leg view: « Arrivée avant 10:00 », « idéale 09:00 ». */
export function windowBanner({ anchor, window, idealTime }: LegSettings): { window: string, ideal: string } {
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
export function rankExplanation({ inWindow, minutesFromIdeal, minutesOutsideWindow, routeRank }: Pick<Candidate, 'inWindow' | 'minutesFromIdeal' | 'minutesOutsideWindow' | 'routeRank'>, routeWeight: number): string {
  if (!inWindow) {
    const outside = `${durationText(minutesOutsideWindow)} hors fenêtre`
    const ranksBelow = routeRank - 1
    if (ranksBelow === 0 || routeWeight === 0) return outside
    return `${outside} + ${ranksBelow} rang${ranksBelow > 1 ? 's' : ''} × ${routeWeight} min`
  }
  if (minutesFromIdeal === 0) return 'Pile à l’heure idéale'
  return `À ${durationText(minutesFromIdeal)} de l’heure idéale`
}

/** Where a booking stands against the candidates: « 2 trains font mieux », « Rien de mieux pour l’instant ». */
export function bookingStanding({ candidatesAbove }: RankedBooking): string {
  if (candidatesAbove === 0) return 'Rien de mieux pour l’instant'
  return `${candidatesAbove} train${candidatesAbove > 1 ? 's' : ''} ${candidatesAbove > 1 ? 'font' : 'fait'} mieux`
}
