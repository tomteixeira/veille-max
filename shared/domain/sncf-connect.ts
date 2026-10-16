/**
 * Links to a pre-filled SNCF Connect search (docs/research/tgvmax-data-source.md,
 * « SNCF Connect deep link »). The format is undocumented and may break: it is
 * pinned by a test.
 */
import type { Candidate, Leg } from './evaluation'
import type { LocalTime, Route } from './trip-template'
import type { ParisDate } from '../utils/paris-time'

/** The SNCF Connect search for trains on `route` leaving on `date` from `time`, Paris time. */
export function sncfConnectSearchLink(route: Route, date: ParisDate, time: LocalTime): string {
  const query = new URLSearchParams({
    redirection_type: 'SEARCH',
    origin_transporter_code: route.originCode,
    destination_transporter_code: route.destinationCode,
    // « YYYY-MM-DD-HH-mm ».
    outward_date: `${date}-${time.replace(':', '-')}`,
  })
  return `https://www.sncf-connect.com/fr-FR/redirect?${query}`
}

/** « Réserver »: the search that lists `candidate` first, from its route, date and departure time. */
export function bookingLink({ train }: Candidate): string {
  return sncfConnectSearchLink(train, train.date, train.departureTime)
}

/**
 * « Vérifier en direct »: the search on a leg's first route from the start of
 * its time window, or from the start of the day when the window has none.
 * `null` when the leg ranks no route.
 */
export function liveCheckLink({ date, settings }: Leg): string | null {
  const [route] = settings.routes
  if (!route) return null
  return sncfConnectSearchLink(route, date, settings.window.start ?? '00:00')
}
