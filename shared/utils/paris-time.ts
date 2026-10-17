/**
 * Every date and time in Veille MAX is read in Paris time, whatever the
 * server's or the device's time zone (spec, "Stack and hosting").
 */
export const PARIS_TIME_ZONE = 'Europe/Paris'

const longDayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** « Vendredi 16 octobre »: the Paris calendar day of an instant, as shown at the top of the home screen. */
export function formatParisLongDay(instant: Date): string {
  const text = longDayFormat.format(instant)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A Paris calendar day, « YYYY-MM-DD », as the `tgvmax` dataset dates trains. */
export type ParisDate = string

// The `en-CA` locale writes dates as « YYYY-MM-DD ».
const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Paris calendar day of an instant. */
export function parisDate(instant: Date): ParisDate {
  return isoDayFormat.format(instant)
}

/** The calendar day `days` days after `date`. */
export function addDays(date: ParisDate, days: number): ParisDate {
  // Calendar arithmetic on a UTC midnight, where every day lasts 24 hours.
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

/** How many calendar days from `from` to `to`: negative when `to` comes first. */
export function daysBetween(from: ParisDate, to: ParisDate): number {
  // Both at UTC midnight, where every day lasts 24 hours.
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 3600 * 1000))
}

// Calendar days are formatted at UTC midnight, where they never shift.
const calendarDayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

/** « Vendredi 23 octobre »: a calendar day in full, as a leg view or a notification names it. */
export function longDayName(date: ParisDate): string {
  const text = calendarDayFormat.format(new Date(`${date}T00:00:00Z`))
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

const snapshotTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

/** « 16 octobre, 06:24 »: when a snapshot was taken, in Paris time. */
export function formatParisSnapshotTime(instant: Date): string {
  const parts = Object.fromEntries(snapshotTimeFormat.formatToParts(instant).map(part => [part.type, part.value]))
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}

// `h23` writes midnight « 00 », where `en-GB` alone may write « 24 ».
const timeOfDayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** « 12:05 »: the Paris time of day of an instant. */
export function parisTimeOfDay(instant: Date): string {
  return timeOfDayFormat.format(instant)
}
