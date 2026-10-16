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
