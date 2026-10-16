import { describe, expect, it } from 'vitest'
import { bookingLink, liveCheckLink, sncfConnectSearchLink } from '#shared/domain/sncf-connect'
import { evaluate, type TrainObservation } from '#shared/domain/evaluation'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

// Friday 16 October 2026, 06:40 in Paris.
const fridayMorning = new Date('2026-10-16T04:40:00Z')

function train(trainNumber: string, route: Route, date: string, departureTime: string, arrivalTime: string): TrainObservation {
  return { date, trainNumber, ...route, departureTime, arrivalTime, open: true }
}

/** The legs of Friday 23 – Sunday 25 October, from the default template: arrive before 10:00, leave after 14:00. */
function legsOf2026W43(observations: TrainObservation[] = []) {
  const template = defaultTripTemplate()
  const settings = {
    template: {
      outbound: { ...template.outbound, routes: [parisLyonToPartDieu, parisLyonToPerrache] },
      return: { ...template.return, routes: [partDieuToParisLyon] },
    },
  }
  return evaluate({ now: fridayMorning, settings, observations }).trips.find(trip => trip.key === '2026-W43')!.legs
}

describe('SNCF Connect links', () => {
  it('open a pre-filled search with the route’s station codes and the local date-time', () => {
    expect(sncfConnectSearchLink(parisLyonToPartDieu, '2026-10-23', '07:00')).toBe(
      'https://www.sncf-connect.com/fr-FR/redirect?redirection_type=SEARCH&origin_transporter_code=FRPLY&destination_transporter_code=FRLPD&outward_date=2026-10-23-07-00',
    )
  })

  it('book a candidate from its route, date and departure time', () => {
    const legs = legsOf2026W43([train('6603', parisLyonToPerrache, '2026-10-23', '07:04', '09:00')])

    expect(bookingLink(legs.outbound.best!)).toBe(sncfConnectSearchLink(parisLyonToPerrache, '2026-10-23', '07:04'))
  })

  it('check a leg live on its first route, from the start of its window', () => {
    const legs = legsOf2026W43()

    expect(liveCheckLink(legs.return)).toBe(sncfConnectSearchLink(partDieuToParisLyon, '2026-10-25', '14:00'))
  })

  it('check a leg whose window has no start from the start of the day', () => {
    const legs = legsOf2026W43()

    expect(liveCheckLink(legs.outbound)).toBe(sncfConnectSearchLink(parisLyonToPartDieu, '2026-10-23', '00:00'))
  })
})
