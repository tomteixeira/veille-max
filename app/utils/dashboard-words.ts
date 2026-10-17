import type { HourBand, LifetimeBucket, LifetimeSpread, SlotGrid } from '#shared/domain/opening-history'
import type { Weekday } from '#shared/domain/trip-template'
import { PARIS_TIME_ZONE } from '#shared/utils/paris-time'
import { WEEKDAY_NAMES } from './leg-words'

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
