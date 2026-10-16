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
