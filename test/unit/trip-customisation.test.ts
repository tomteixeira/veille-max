import { describe, expect, it } from 'vitest'
import {
  customiseTrip,
  evaluate,
  legDateChoices,
  type Evaluation,
  type TrainObservation,
  type TravellerSettings,
  type TripCustomisation,
  type TripMute,
} from '#shared/domain/evaluation'
import { defaultTripTemplate, type Route, type TemplateLeg } from '#shared/domain/trip-template'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToMarseille: Route = { originCode: 'FRPLY', destinationCode: 'FRMSC' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }
const marseilleToParisLyon: Route = { originCode: 'FRMSC', destinationCode: 'FRPLY' }

// Friday 16 October 2026, 06:40 in Paris: the horizon ends on Sunday 15 November.
const fridayMorning = new Date('2026-10-16T04:40:00Z')

/** The default template (Friday out, arrive before 10:00, ideally 09:00; Sunday back, leave after 14:00, ideally 17:00), to Lyon. */
function settings({ outbound = {}, returnLeg = {}, customisations, mutes }: {
  outbound?: Partial<TemplateLeg>
  returnLeg?: Partial<TemplateLeg>
  customisations?: Record<string, TripCustomisation>
  mutes?: TripMute[]
} = {}): TravellerSettings {
  const template = defaultTripTemplate()
  return {
    template: {
      outbound: { ...template.outbound, routes: [parisLyonToPartDieu], ...outbound },
      return: { ...template.return, routes: [partDieuToParisLyon], ...returnLeg },
    },
    customisations,
    mutes,
  }
}

function train(trainNumber: string, route: Route, date: string, departureTime: string, arrivalTime: string): TrainObservation {
  return { date, trainNumber, ...route, departureTime, arrivalTime, open: true }
}

function trip(evaluation: Evaluation, key: string) {
  const found = [...evaluation.trips, ...evaluation.upcoming].find(trip => trip.key === key)
  if (!found) throw new Error(`No trip ${key}`)
  return found
}

/** The trip of week 43 (23 – 25 October) customised to Marseille, leaving on Thursday 22. */
function toMarseilleOnThursday(): TripCustomisation {
  const week43 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W43')
  const customisation = customiseTrip(week43, 'outbound', {
    date: '2026-10-22',
    anchor: 'departure',
    window: { start: '18:00', end: null },
    idealTime: '19:00',
    routes: [parisLyonToMarseille],
  })
  return { ...customisation, return: { ...customisation.return, routes: [marseilleToParisLyon] } }
}

describe('trip customisation', () => {
  describe('copy-on-write', () => {
    it('copies the template’s settings of both legs into the trip on its first change', () => {
      const week43 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W43')

      const customisation = customiseTrip(week43, 'return', { date: '2026-10-26' })

      expect(customisation).toEqual({
        outbound: { date: '2026-10-23', anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu] },
        return: { date: '2026-10-26', anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
      })
    })

    it('marks a customised trip, and evaluates its legs with their own date, window, ideal time and routes', () => {
      const observations = [
        // The template's Friday train to Lyon is no longer a candidate.
        train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', '08:56'),
        train('6171', parisLyonToMarseille, '2026-10-22', '17:37', '20:56'),
        train('6177', parisLyonToMarseille, '2026-10-22', '19:07', '22:24'),
        train('6114', marseilleToParisLyon, '2026-10-25', '16:04', '19:22'),
      ]

      const evaluation = evaluate({ now: fridayMorning, settings: settings({ customisations: { '2026-W43': toMarseilleOnThursday() } }), observations })
      const week43 = trip(evaluation, '2026-W43')

      expect(week43.customised).toBe(true)
      expect(week43.legs.outbound).toMatchObject({ date: '2026-10-22', settings: { anchor: 'departure', idealTime: '19:00', routes: [parisLyonToMarseille] } })
      expect(week43.legs.outbound.candidates.map(candidate => [candidate.train.trainNumber, candidate.inWindow])).toEqual([['6177', true], ['6171', false]])
      expect(week43.legs.return.candidates.map(candidate => candidate.train.trainNumber)).toEqual(['6114'])
      expect(trip(evaluation, '2026-W44').customised).toBe(false)
    })

    it('orders the tracked trips by their first leg’s date, whatever their key', () => {
      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations: [] })
      const customisations = {
        '2026-W43': customiseTrip(trip(evaluation, '2026-W43'), 'return', { date: '2026-10-28' }),
        '2026-W44': customiseTrip(trip(evaluation, '2026-W44'), 'outbound', { date: '2026-10-23' }),
      }
      customisations['2026-W43'].outbound.date = '2026-10-25'

      const { trips } = evaluate({ now: fridayMorning, settings: settings({ customisations }), observations: [] })

      expect(trips.slice(1, 3).map(trip => [trip.key, trip.legs.outbound.date])).toEqual([['2026-W44', '2026-10-23'], ['2026-W43', '2026-10-25']])
    })

    it('keeps the trip’s key when its dates change', () => {
      const evaluation = evaluate({ now: fridayMorning, settings: settings({ customisations: { '2026-W43': toMarseilleOnThursday() } }), observations: [] })

      expect(evaluation.trips.map(trip => [trip.key, trip.legs.outbound.date])).toContainEqual(['2026-W43', '2026-10-22'])
    })
  })

  describe('template changes', () => {
    it('apply to every trip but the customised ones', () => {
      const customisations = { '2026-W43': toMarseilleOnThursday() }
      const toPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }

      const evaluation = evaluate({ now: fridayMorning, settings: settings({ outbound: { weekday: 6, routes: [toPerrache] }, customisations }), observations: [] })

      expect(trip(evaluation, '2026-W43').legs.outbound).toMatchObject({ date: '2026-10-22', settings: { routes: [parisLyonToMarseille] } })
      expect(trip(evaluation, '2026-W44').legs.outbound).toMatchObject({ date: '2026-10-31', settings: { routes: [toPerrache] } })
    })

    it('apply again to a trip once it is reset', () => {
      const toPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }

      // Resetting a trip drops its customisation.
      const evaluation = evaluate({ now: fridayMorning, settings: settings({ outbound: { routes: [toPerrache] }, customisations: {} }), observations: [] })

      expect(trip(evaluation, '2026-W43')).toMatchObject({ customised: false, legs: { outbound: { date: '2026-10-23', settings: { routes: [toPerrache] } } } })
    })
  })

  describe('leg date choices', () => {
    it('offer the outbound leg the week up to the return leg, and the return leg the week from the outbound leg', () => {
      const week43 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W43')

      expect(legDateChoices(week43, 'outbound', fridayMorning)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
      // Week 43 runs from Monday 19 to Sunday 25 October: its legs stay within three days of it.
      expect(legDateChoices(week43, 'return', fridayMorning)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'])
    })

    it('stay within three days of the trip’s week, however often its legs move', () => {
      const week43 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W43')
      const late = { ...week43, legs: { outbound: { ...week43.legs.outbound, date: '2026-10-27' }, return: { ...week43.legs.return, date: '2026-10-28' } } }
      const early = { ...week43, legs: { outbound: { ...week43.legs.outbound, date: '2026-10-16' }, return: { ...week43.legs.return, date: '2026-10-17' } } }

      expect(legDateChoices(late, 'return', fridayMorning)).toEqual(['2026-10-27', '2026-10-28'])
      expect(legDateChoices(early, 'outbound', fridayMorning)).toEqual(['2026-10-16', '2026-10-17'])
    })

    it('leave out the days that have passed, but the leg’s own', () => {
      const week42 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W42')
      const saturday = new Date('2026-10-17T10:00:00Z')

      expect(legDateChoices(week42, 'outbound', saturday)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18'])
      expect(legDateChoices(week42, 'return', saturday)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'])
    })
  })

  describe('upcoming trips', () => {
    it('are the next two trips beyond the horizon, with the day they enter it', () => {
      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations: [] })

      expect(evaluation.trips.at(-1)?.key).toBe('2026-W46')
      expect(evaluation.upcoming.map(trip => [trip.key, trip.legs.outbound.date, trip.legs.return.date, trip.opensOn])).toEqual([
        ['2026-W47', '2026-11-20', '2026-11-22', '2026-10-21'],
        ['2026-W48', '2026-11-27', '2026-11-29', '2026-10-28'],
      ])
    })

    it('can be customised and muted in advance', () => {
      const week47 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W47')
      const customisation = customiseTrip(week47, 'outbound', { date: '2026-11-19' })

      const evaluation = evaluate({ now: fridayMorning, settings: settings({ customisations: { '2026-W47': customisation }, mutes: [{ tripKey: '2026-W47' }] }), observations: [] })

      // Leaving on Thursday 19 November, it opens a day earlier.
      expect(evaluation.upcoming[0]).toMatchObject({ key: '2026-W47', customised: true, muted: true, opensOn: '2026-10-20', legs: { outbound: { date: '2026-11-19' } } })
    })

    it('become tracked when they enter the horizon, keeping their customisation and mute', () => {
      const week47 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W47')
      const customisations = { '2026-W47': customiseTrip(week47, 'outbound', { routes: [parisLyonToMarseille] }) }
      const mutes = [{ tripKey: '2026-W47', leg: 'return' as const }]

      const tuesday = evaluate({ now: new Date('2026-10-20T10:00:00Z'), settings: settings({ customisations, mutes }), observations: [] })
      const wednesday = evaluate({ now: new Date('2026-10-21T10:00:00Z'), settings: settings({ customisations, mutes }), observations: [] })

      expect(tuesday.upcoming.map(trip => trip.key)).toEqual(['2026-W47', '2026-W48'])
      expect(wednesday.upcoming.map(trip => trip.key)).toEqual(['2026-W48', '2026-W49'])
      expect(wednesday.trips.at(-1)).toMatchObject({
        key: '2026-W47',
        customised: true,
        legs: { outbound: { settings: { routes: [parisLyonToMarseille] } }, return: { muted: true } },
      })
    })
  })

  describe('archiving', () => {
    it('keeps a trip tracked until its last effective leg date has passed', () => {
      const week42 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W42')
      // Coming back on Monday 19 instead of Sunday 18.
      const customisations = { '2026-W42': customiseTrip(week42, 'return', { date: '2026-10-19' }) }

      const monday = evaluate({ now: new Date('2026-10-19T10:00:00Z'), settings: settings({ customisations }), observations: [] })
      const tuesday = evaluate({ now: new Date('2026-10-20T10:00:00Z'), settings: settings({ customisations }), observations: [] })

      expect(monday.trips[0]).toMatchObject({ key: '2026-W42', legs: { outbound: { status: 'past' }, return: { date: '2026-10-19', status: 'none' } } })
      expect(tuesday.trips[0]?.key).toBe('2026-W43')
    })

    it('hides a trip whose legs have all passed, even customised or muted', () => {
      const week43 = trip(evaluate({ now: fridayMorning, settings: settings(), observations: [] }), '2026-W43')
      const customisations = { '2026-W43': customiseTrip(week43, 'outbound', { routes: [parisLyonToMarseille] }) }

      const later = evaluate({ now: new Date('2026-10-26T10:00:00Z'), settings: settings({ customisations, mutes: [{ tripKey: '2026-W43' }] }), observations: [] })

      expect(later.trips.map(trip => trip.key)).not.toContain('2026-W43')
      expect(later.trips[0]?.key).toBe('2026-W44')
    })
  })

  describe('mutes', () => {
    const observations = [
      train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', '08:56'),
      train('6680', partDieuToParisLyon, '2026-10-25', '17:04', '19:00'),
    ]

    it('mute a whole trip, which keeps its candidates', () => {
      const evaluation = evaluate({ now: fridayMorning, settings: settings({ mutes: [{ tripKey: '2026-W43' }] }), observations })
      const week43 = trip(evaluation, '2026-W43')

      expect(week43.muted).toBe(true)
      expect([week43.legs.outbound.muted, week43.legs.return.muted]).toEqual([true, true])
      expect(week43.legs.outbound.best?.train.trainNumber).toBe('6603')
      expect(week43.legs.outbound.status).toBe('available')
      expect(trip(evaluation, '2026-W44').muted).toBe(false)
    })

    it('mute a single leg, which keeps its candidates', () => {
      const week43 = trip(evaluate({ now: fridayMorning, settings: settings({ mutes: [{ tripKey: '2026-W43', leg: 'return' }] }), observations }), '2026-W43')

      expect(week43.muted).toBe(false)
      expect([week43.legs.outbound.muted, week43.legs.return.muted]).toEqual([false, true])
      expect(week43.legs.return.best?.train.trainNumber).toBe('6680')
    })
  })
})
