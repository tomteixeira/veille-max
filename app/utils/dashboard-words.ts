import type { LegHistoryColumn } from '#shared/domain/leg-history'
import type { HourBand, LifetimeBucket, LifetimeSpread, SlotGrid } from '#shared/domain/opening-history'
import type { LegKind, Weekday } from '#shared/domain/trip-template'
import { longDayName, PARIS_TIME_ZONE, type ParisDate } from '#shared/utils/paris-time'
import { LEG_NAMES, WEEKDAY_NAMES } from './leg-words'
import { shortDay } from './trip-words'

// The dashboard's words: each card is titled with its one-sentence conclusion,
// computed from the data (spec, UI module, « Histoires »).

/** « Les places sortent en trois vagues : J-29, J-11 et J-3. », or `null` without a wave. */
export function curveHeadline(peaks: readonly number[]): string | null {
  const days = peaks.map(daysBefore => `J-${daysBefore}`)
  if (days.length === 0) return null
  if (days.length === 1) return `Les places sortent surtout à ${days[0]}.`
  const count = days.length === 2 ? 'deux' : 'trois'
  return `Les places sortent en ${count} vagues : ${days.slice(0, -1).join(', ')} et ${days.at(-1)}.`
}

/** « < 8 h », « 8–11 h », « 20 h + »: an hour band, in a chart's header. */
export function bandLabel({ fromHour, toHour }: HourBand): string {
  if (fromHour === 0) return `< ${toHour} h`
  if (toHour === 24) return `${fromHour} h +`
  return `${fromHour}–${toHour} h`
}

/** « avant 8 h », « de 8 h à 11 h », « après 20 h »: an hour band, inside a sentence. */
function bandInSentence({ fromHour, toHour }: HourBand): string {
  if (fromHour === 0) return `avant ${toHour} h`
  if (toHour === 24) return `après ${fromHour} h`
  return `de ${fromHour} h à ${toHour} h`
}

/** « Meilleur créneau : le dimanche de 17 h à 20 h, où 50 % des trains ont une place. », or `null` without any train. */
export function slotHeadline({ best, bands }: SlotGrid): string | null {
  if (!best) return null
  const band = bands[best.bandIndex]!
  return `Meilleur créneau : le ${WEEKDAY_NAMES[best.weekday].toLowerCase()} ${bandInSentence(band)}, où ${best.percent} % des trains ont une place.`
}

/** « < 1 j », « 2 j », « 3–6 j », « 7 j + »: a range of opening lifetimes. */
export function lifetimeLabel({ fromDays, toDays }: Pick<LifetimeBucket, 'fromDays' | 'toDays'>): string {
  if (toDays === null) return `${fromDays} j +`
  if (toDays === 0) return '< 1 j'
  if (fromDays === toDays) return `${fromDays} j`
  return `${fromDays}–${toDays} j`
}

/** « 46 % des places ont disparu dès le lendemain matin. », or `null` without any seat seen taken. */
export function lifetimeHeadline({ buckets, total }: LifetimeSpread): string | null {
  if (total === 0) return null
  const withinADay = buckets.find(bucket => bucket.toDays === 0)?.percent ?? 0
  return `${withinADay} % des places ont disparu dès le lendemain matin.`
}

/** « Vendredi & dimanche »: the trip weekdays, as the dashboard filter names them. */
export function weekdaysLabel(weekdays: readonly Weekday[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b).map((weekday, index) => {
    const name = WEEKDAY_NAMES[weekday]
    return index === 0 ? name : name.toLowerCase()
  })
  if (sorted.length < 2) return sorted.join('')
  return `${sorted.slice(0, -1).join(', ')} & ${sorted.at(-1)}`
}

/** « Lun »: a weekday, as a heatmap row names it. */
export function shortWeekday(weekday: Weekday): string {
  return WEEKDAY_NAMES[weekday].slice(0, 3)
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TIME_ZONE, day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })

/** « Vos routes · depuis le 16 oct. »: the dashboard's scope, from the first ingested snapshot. */
export function dashboardScope(since: string | null): string {
  return since ? `Vos routes · depuis le ${shortDate.format(new Date(since))}` : 'Vos routes · aucun instantané pour l’instant'
}

/** Why a chart is still empty: the history starts at the first ingested snapshot, on « 16 octobre 2026 ». */
export function emptyHistoryText(since: string | null, hasRoutes: boolean): string {
  if (!hasRoutes) return 'Ajoutez vos routes dans Réglages : leur historique démarrera au prochain instantané.'
  if (!since) return 'L’historique démarre au premier instantané lu par Veille MAX, chaque matin.'
  return `L’historique a démarré le ${longDate.format(new Date(since))}, au premier instantané lu par Veille MAX : les tendances arrivent après quelques matins de veille.`
}

/** « Vous réservez en moyenne à J-9. »: the bookings card's pace line. */
export function bookingPaceText(averageDaysBefore: number | null): string {
  if (averageDaysBefore === null) return 'Votre rythme de réservation apparaîtra après votre première réservation.'
  if (averageDaysBefore === 0) return 'Vous réservez en moyenne le jour du départ.'
  return `Vous réservez en moyenne à J-${averageDaysBefore}.`
}

// Calendar days are formatted at UTC midnight, where they never shift.
const shortMonth = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'short' })

/** « Aller · Ven 23 oct. »: a leg, on its history chip. */
export function historyLegLabel({ kind, date }: { kind: LegKind, date: ParisDate }): string {
  return `${LEG_NAMES[kind]} · ${shortDay(date)} ${shortMonth.format(new Date(`${date}T00:00:00Z`))}`
}

/** « J-6 », « Départ »: how many days before departure a snapshot was taken. */
export function daysBeforeLabel(daysBefore: number): string {
  return daysBefore === 0 ? 'Départ' : `J-${daysBefore}`
}

/** « trajet réservé », « trajets réservés »: the bookings card's caption under its count. */
export function bookedTripsText(count: number): string {
  return count > 1 ? 'trajets réservés en ce moment' : 'trajet réservé en ce moment'
}

/** « aucun train », « 1 train », « 3 trains ». */
export function trainsText(count: number): string {
  if (count === 0) return 'aucun train'
  return `${count} train${count > 1 ? 's' : ''}`
}

/**
 * A leg history's conclusion: « Aller du vendredi 23 octobre : 3 trains au
 * dernier instantané. » until the leg leaves, then its peak, « jusqu’à 5
 * trains, à J-8. »; `null` without any snapshot.
 */
export function legHistoryHeadline({ kind, date, past, columns }: { kind: LegKind, date: ParisDate, past: boolean, columns: readonly LegHistoryColumn[] }): string | null {
  const latest = columns.at(-1)
  if (!latest) return null
  const leg = `${LEG_NAMES[kind]} du ${longDayName(date).toLowerCase()}`
  if (!past) return `${leg} : ${trainsText(latest.candidates)} au dernier instantané.`

  // The first snapshot with the most candidates.
  const peak = columns.reduce((best, column) => (column.candidates > best.candidates ? column : best))
  if (peak.candidates === 0) return `${leg} : aucun train n’a eu de place.`
  return `${leg} : jusqu’à ${trainsText(peak.candidates)}, à J-${peak.daysBefore}.`
}
