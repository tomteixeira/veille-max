import { describe, expect, it } from 'vitest'
import { evaluate, type Booking, type TrainObservation, type TravellerSettings } from '#shared/domain/evaluation'
import { defaultTripTemplate, type Route, type TemplateLeg } from '#shared/domain/trip-template'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const chessyToPartDieu: Route = { originCode: 'FRMLV', destinationCode: 'FRLPD' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

// Friday 16 October 2026, 06:40 in Paris, just after the morning snapshot.
const fridayMorning = new Date('2026-10-16T04:40:00Z')

/** The default template (Friday out, arrive before 10:00, ideally 09:00; Sunday back, leave after 14:00, ideally 17:00), with routes. */
function settings({ outbound = {}, returnLeg = {}, routeWeight, bookings }: { outbound?: Partial<TemplateLeg>, returnLeg?: Partial<TemplateLeg>, routeWeight?: number, bookings?: Booking[] } = {}): TravellerSettings {
  const template = defaultTripTemplate()
  return {
    template: {
      outbound: { ...template.outbound, routes: [parisLyonToPartDieu, parisLyonToPerrache, chessyToPartDieu], ...outbound },
      return: { ...template.return, routes: [partDieuToParisLyon], ...returnLeg },
    },
    routeWeight,
    bookings,
  }
}

function train(trainNumber: string, route: Route, date: string, departureTime: string, arrivalTime: string, open = true): TrainObservation {
  return { date, trainNumber, ...route, departureTime, arrivalTime, open }
}

/** The booking of `trainObservation` on a leg; the booked train may show no seat any more. */
function booking(tripKey: string, legKind: 'outbound' | 'return', { open: _open, ...bookedTrain }: TrainObservation): Booking {
  return { tripKey, legKind, train: bookedTrain }
}

/** The train numbers of a leg's candidates, in ranking order. */
function ranking(evaluation: ReturnType<typeof evaluate>, tripKey: string, leg: 'outbound' | 'return' = 'outbound') {
  const trip = evaluation.trips.find(trip => trip.key === tripKey)
  return trip?.legs[leg].candidates.map(candidate => candidate.train.trainNumber)
}

describe('evaluation', () => {
  describe('trips of the tracking horizon', () => {
    it('generates one trip per template weekend from today to D+30, keyed by the ISO week of its outbound date', () => {
      const { trips } = evaluate({ now: fridayMorning, settings: settings(), observations: [] })

      expect(trips.map(trip => [trip.key, trip.legs.outbound.date, trip.legs.return.date])).toEqual([
        ['2026-W42', '2026-10-16', '2026-10-18'],
        ['2026-W43', '2026-10-23', '2026-10-25'],
        ['2026-W44', '2026-10-30', '2026-11-01'],
        ['2026-W45', '2026-11-06', '2026-11-08'],
        ['2026-W46', '2026-11-13', '2026-11-15'],
      ])
    })

    it('keeps tracking a trip until its return date has passed', () => {
      const saturday = evaluate({ now: new Date('2026-10-17T10:00:00Z'), settings: settings(), observations: [] })
      const monday = evaluate({ now: new Date('2026-10-19T10:00:00Z'), settings: settings(), observations: [] })

      expect(saturday.trips[0]?.key).toBe('2026-W42')
      expect(monday.trips[0]?.key).toBe('2026-W43')
    })

    it('reads today in Paris across the switch to winter time', () => {
      // After 2026-10-25 Paris is UTC+1: 23:30 UTC on Tuesday 3 November is already Wednesday 4.
      const tuesdayNight = evaluate({ now: new Date('2026-11-03T22:30:00Z'), settings: settings(), observations: [] })
      const wednesdayNight = evaluate({ now: new Date('2026-11-03T23:30:00Z'), settings: settings(), observations: [] })

      // The horizon ends on Thursday 3 December, then on Friday 4 December.
      expect(tuesdayNight.trips.map(trip => trip.key)).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48'])
      expect(wednesdayNight.trips.map(trip => trip.key)).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49'])
      expect(wednesdayNight.trips.map(trip => trip.legs.outbound.date)).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04'])
    })

    it('keeps the template weekdays on both sides of the switch to winter time', () => {
      const { trips } = evaluate({ now: new Date('2026-10-22T10:00:00Z'), settings: settings(), observations: [] })

      expect(trips.map(trip => [trip.legs.outbound.date, trip.legs.return.date])).toEqual([
        ['2026-10-23', '2026-10-25'],
        ['2026-10-30', '2026-11-01'],
        ['2026-11-06', '2026-11-08'],
        ['2026-11-13', '2026-11-15'],
        ['2026-11-20', '2026-11-22'],
      ])
    })

    it('tracks a trip as soon as its outbound date enters the horizon, even if its return date is still beyond it', () => {
      // The horizon of Wednesday 21 October ends on Friday 20 November.
      const { trips } = evaluate({ now: new Date('2026-10-21T10:00:00Z'), settings: settings(), observations: [] })

      expect(trips.at(-1)).toMatchObject({ key: '2026-W47', legs: { outbound: { date: '2026-11-20' }, return: { date: '2026-11-22' } } })
    })

    it('keys a trip by its ISO week year, which can differ from its calendar year', () => {
      const { trips } = evaluate({ now: new Date('2026-12-20T10:00:00Z'), settings: settings(), observations: [] })

      expect(trips.map(trip => [trip.key, trip.legs.outbound.date])).toEqual([
        ['2026-W51', '2026-12-18'],
        ['2026-W52', '2026-12-25'],
        ['2026-W53', '2027-01-01'],
        ['2027-W01', '2027-01-08'],
        ['2027-W02', '2027-01-15'],
      ])
    })

    it('dates a return leg on a weekday before the outbound one in the following week', () => {
      const thursdayToMonday = settings({ outbound: { weekday: 4 }, returnLeg: { weekday: 1 } })

      const { trips } = evaluate({ now: fridayMorning, settings: thursdayToMonday, observations: [] })

      // Thursday 15 October's trip is still tracked: its return is on Monday 19.
      expect(trips[0]).toMatchObject({ key: '2026-W42', legs: { outbound: { date: '2026-10-15' }, return: { date: '2026-10-19' } } })
    })
  })

  describe('archived trips', () => {
    // Wednesday 28 October 2026.
    const wednesday = new Date('2026-10-28T10:00:00Z')

    it('are none unless asked for', () => {
      const { archived } = evaluate({ now: wednesday, settings: settings(), observations: [] })

      expect(archived).toEqual([])
    })

    it('are the trips whose legs have all passed, since a given day, soonest first', () => {
      const { trips, archived } = evaluate({ now: wednesday, settings: settings(), observations: [], archivedSince: '2026-10-01' })

      expect(archived.map(trip => [trip.key, trip.legs.outbound.date, trip.legs.return.date])).toEqual([
        ['2026-W40', '2026-10-02', '2026-10-04'],
        ['2026-W41', '2026-10-09', '2026-10-11'],
        ['2026-W42', '2026-10-16', '2026-10-18'],
        ['2026-W43', '2026-10-23', '2026-10-25'],
      ])
      expect(trips[0]?.key).toBe('2026-W44')
    })

    it('keep a trip one of whose legs is on or after that day', () => {
      const { archived } = evaluate({ now: wednesday, settings: settings(), observations: [], archivedSince: '2026-10-17' })

      expect(archived.map(trip => trip.key)).toEqual(['2026-W42', '2026-W43'])
    })

    it('keep their customised settings, and their legs are past, with their booking but no candidate', () => {
      const booked = settings({ bookings: [booking('2026-W43', 'outbound', train('6611', parisLyonToPerrache, '2026-10-22', '07:10', '09:06'))] })
      // Thursday 22 out, on Perrache only; Sunday 25 back.
      const thursday = { ...booked.template.outbound, date: '2026-10-22', routes: [parisLyonToPerrache] }
      const withCustomisation = { ...booked, customisations: { '2026-W43': { outbound: thursday, return: { ...booked.template.return, date: '2026-10-25' } } } }

      const { archived } = evaluate({ now: wednesday, settings: withCustomisation, observations: [], archivedSince: '2026-10-20' })

      expect(archived).toHaveLength(1)
      expect(archived[0]).toMatchObject({ key: '2026-W43', customised: true })
      expect(archived[0]?.legs.outbound).toMatchObject({ date: '2026-10-22', status: 'past', candidates: [], best: null, settings: { routes: [parisLyonToPerrache] } })
      expect(archived[0]?.legs.outbound.booking?.train.trainNumber).toBe('6611')
    })

    it('are neither given references nor notified', () => {
      const evaluation = evaluate({ now: wednesday, settings: settings(), observations: [], archivedSince: '2026-10-01' })

      expect(evaluation.references.map(reference => reference.tripKey)).not.toContain('2026-W43')
      expect(evaluation.improvements).toEqual([])
    })
  })

  describe('candidates', () => {
    it('are the trains with an open seat on one of the leg’s routes, on the leg’s date', () => {
      const observations = [
        train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', '08:56'),
        train('6605', parisLyonToPartDieu, '2026-10-23', '08:00', '09:56', false),
        train('6607', parisLyonToPartDieu, '2026-10-24', '07:00', '08:56'),
        train('8501', { originCode: 'FRPMO', destinationCode: 'FRLPD' }, '2026-10-23', '07:52', '09:58'),
        train('6680', partDieuToParisLyon, '2026-10-23', '17:04', '19:00'),
        train('6680', partDieuToParisLyon, '2026-10-25', '17:04', '19:00'),
      ]

      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations })

      expect(ranking(evaluation, '2026-W43', 'outbound')).toEqual(['6603'])
      expect(ranking(evaluation, '2026-W43', 'return')).toEqual(['6680'])
      expect(evaluation.trips.find(trip => trip.key === '2026-W43')?.legs.return.best?.train.date).toBe('2026-10-25')
    })

    it('leaves a leg with no open seat without a best candidate', () => {
      const observations = [train('6605', parisLyonToPartDieu, '2026-10-23', '08:00', '09:56', false)]

      const leg = evaluate({ now: fridayMorning, settings: settings(), observations }).trips[1]?.legs.outbound

      expect(leg?.candidates).toEqual([])
      expect(leg?.best).toBeNull()
    })
  })

  describe('leg settings', () => {
    it('come with each leg: its window, ideal time and ranked routes', () => {
      const leg = evaluate({ now: fridayMorning, settings: settings(), observations: [] }).trips[1]?.legs.outbound

      // The leg's day is its date, which a customised trip can move off the template's weekday.
      expect(leg?.settings).toEqual({
        anchor: 'arrival',
        window: { start: null, end: '10:00' },
        idealTime: '09:00',
        routes: [parisLyonToPartDieu, parisLyonToPerrache, chessyToPartDieu],
      })
    })
  })

  describe('leg status', () => {
    it('tells a leg with an in-window best candidate, one with only out-of-window candidates, and one with none', () => {
      const observations = [
        train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', '08:56'),
        train('6619', parisLyonToPartDieu, '2026-10-30', '12:00', '13:56'),
      ]

      const { trips } = evaluate({ now: fridayMorning, settings: settings(), observations })

      expect(trips.slice(1, 3).map(trip => [trip.legs.outbound.status, trip.legs.return.status])).toEqual([
        ['available', 'none'],
        ['outside-window', 'none'],
      ])
    })

    it('shows the leg of a trip in progress that already left as past, without candidates', () => {
      const observations = [train('6603', parisLyonToPartDieu, '2026-10-16', '07:00', '08:56')]

      const saturday = evaluate({ now: new Date('2026-10-17T10:00:00Z'), settings: settings(), observations })

      expect(saturday.trips[0]?.legs.outbound).toMatchObject({ date: '2026-10-16', status: 'past', candidates: [], best: null })
      expect(saturday.trips[0]?.legs.return.status).toBe('none')
    })
  })

  describe('ranking', () => {
    // Outbound: arrive before 10:00, ideally at 09:00.
    it('ranks in-window candidates by route rank, then closeness to the ideal time, then earlier departure', () => {
      const observations = [
        train('perfect-on-route-2', parisLyonToPerrache, '2026-10-23', '07:04', '09:00'),
        train('hour-early', parisLyonToPartDieu, '2026-10-23', '06:04', '08:00'),
        train('half-hour-late', parisLyonToPartDieu, '2026-10-23', '07:34', '09:30'),
        train('half-hour-early', parisLyonToPartDieu, '2026-10-23', '06:34', '08:30'),
        train('half-hour-early-slower', parisLyonToPartDieu, '2026-10-23', '06:20', '08:30'),
        train('outside-on-route-1', parisLyonToPartDieu, '2026-10-23', '08:04', '10:01'),
      ]

      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations })

      expect(ranking(evaluation, '2026-W43')).toEqual([
        'half-hour-early-slower',
        'half-hour-early',
        'half-hour-late',
        'hour-early',
        'perfect-on-route-2',
        'outside-on-route-1',
      ])
    })

    describe('out of the window, a slightly later train from a better route can win', () => {
      // Arrive before 10:00: route 1 arrives 60 minutes late, route 3 arrives 25 minutes late.
      const observations = [
        train('route-3-at-10:25', chessyToPartDieu, '2026-10-23', '08:27', '10:25'),
        train('route-1-at-11:00', parisLyonToPartDieu, '2026-10-23', '09:04', '11:00'),
      ]

      it('with a route weight of 30: 60 minutes beat 25 + 2 × 30', () => {
        const evaluation = evaluate({ now: fridayMorning, settings: settings({ routeWeight: 30 }), observations })

        expect(ranking(evaluation, '2026-W43')).toEqual(['route-1-at-11:00', 'route-3-at-10:25'])
      })

      it('with a route weight of 10: 25 + 2 × 10 beat 60 minutes', () => {
        const evaluation = evaluate({ now: fridayMorning, settings: settings({ routeWeight: 10 }), observations })

        expect(ranking(evaluation, '2026-W43')).toEqual(['route-3-at-10:25', 'route-1-at-11:00'])
      })

      it('with no route weight set, weighs a route rank 30 minutes', () => {
        const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations })

        expect(ranking(evaluation, '2026-W43')).toEqual(['route-1-at-11:00', 'route-3-at-10:25'])
      })
    })

    it('breaks an out-of-window tie by route rank, then earlier departure', () => {
      // Each costs 60 minutes: 60 late on route 1, or 30 late + 30 on route 2.
      const observations = [
        train('route-2-at-10:30', parisLyonToPerrache, '2026-10-23', '08:30', '10:30'),
        train('route-1-at-11:00-slower', parisLyonToPartDieu, '2026-10-23', '08:50', '11:00'),
        train('route-1-at-11:00', parisLyonToPartDieu, '2026-10-23', '09:04', '11:00'),
      ]

      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations })

      expect(ranking(evaluation, '2026-W43')).toEqual(['route-1-at-11:00-slower', 'route-1-at-11:00', 'route-2-at-10:30'])
    })

    it('reads a departure-anchored window on the departure time', () => {
      // Return: leave after 14:00, ideally at 17:00.
      const observations = [
        train('leaves-13:00', partDieuToParisLyon, '2026-10-25', '13:00', '15:00'),
        train('leaves-15:00', partDieuToParisLyon, '2026-10-25', '15:00', '17:00'),
        train('leaves-16:30', partDieuToParisLyon, '2026-10-25', '16:30', '18:30'),
        train('leaves-20:00', partDieuToParisLyon, '2026-10-25', '20:00', '22:00'),
      ]

      const evaluation = evaluate({ now: fridayMorning, settings: settings(), observations })

      expect(ranking(evaluation, '2026-W43', 'return')).toEqual(['leaves-16:30', 'leaves-15:00', 'leaves-20:00', 'leaves-13:00'])
    })

    it('reads an arrival-anchored window on the arrival time', () => {
      // Leaving at 09:30 fits « arrive before 10:00 » only on the departure time.
      const observations = [
        train('leaves-09:30', parisLyonToPartDieu, '2026-10-23', '09:30', '11:26'),
        train('arrives-09:56', parisLyonToPartDieu, '2026-10-23', '08:00', '09:56'),
      ]

      const leg = evaluate({ now: fridayMorning, settings: settings(), observations }).trips[1]?.legs.outbound

      expect(leg?.candidates.map(({ train, inWindow, minutesOutsideWindow }) => [train.trainNumber, inWindow, minutesOutsideWindow]))
        .toEqual([['arrives-09:56', true, 0], ['leaves-09:30', false, 86]])
    })

    it('reads a window with both bounds, and a window with none', () => {
      const observations = [
        train('arrives-07:30', parisLyonToPartDieu, '2026-10-23', '05:34', '07:30'),
        train('arrives-09:30', parisLyonToPartDieu, '2026-10-23', '07:34', '09:30'),
        train('arrives-12:00', parisLyonToPartDieu, '2026-10-23', '10:04', '12:00'),
      ]
      const between = settings({ outbound: { window: { start: '08:00', end: '10:00' } } })
      const anytime = settings({ outbound: { window: { start: null, end: null }, idealTime: '12:00' } })

      const betweenLeg = evaluate({ now: fridayMorning, settings: between, observations }).trips[1]?.legs.outbound
      const anytimeLeg = evaluate({ now: fridayMorning, settings: anytime, observations }).trips[1]?.legs.outbound

      expect(betweenLeg?.candidates.map(({ train, minutesOutsideWindow }) => [train.trainNumber, minutesOutsideWindow]))
        .toEqual([['arrives-09:30', 0], ['arrives-07:30', 30], ['arrives-12:00', 120]])
      expect(anytimeLeg?.candidates.map(({ train, inWindow }) => [train.trainNumber, inWindow]))
        .toEqual([['arrives-12:00', true], ['arrives-09:30', true], ['arrives-07:30', true]])
    })

    it('reads an arrival earlier than the departure as the next day', () => {
      // Return: arrive before 23:30, ideally at 22:00.
      const lateReturn = settings({ returnLeg: { anchor: 'arrival', window: { start: null, end: '23:30' }, idealTime: '22:00' } })
      const observations = [
        train('arrives-00:10', partDieuToParisLyon, '2026-10-25', '22:00', '00:10'),
        train('arrives-23:50', partDieuToParisLyon, '2026-10-25', '21:50', '23:50'),
      ]

      const leg = evaluate({ now: fridayMorning, settings: lateReturn, observations }).trips[1]?.legs.return

      expect(leg?.candidates.map(({ train, minutesOutsideWindow, durationMinutes }) => [train.trainNumber, minutesOutsideWindow, durationMinutes]))
        .toEqual([['arrives-23:50', 20, 120], ['arrives-00:10', 40, 130]])
    })
  })

  describe('bookings', () => {
    it('show on their leg, ranked with the same rules as candidates', () => {
      // Route 2 booked, leaving at 07:10; route 1 leaving at 06:05 then appears: it ranks above the booking.
      const booked = train('6611', parisLyonToPerrache, '2026-10-23', '07:10', '09:06', false)
      const observations = [
        booked,
        train('6601', parisLyonToPartDieu, '2026-10-23', '06:05', '08:01'),
        train('6615', parisLyonToPerrache, '2026-10-23', '08:04', '10:00'),
        train('6631', chessyToPartDieu, '2026-10-23', '09:00', '11:00'),
      ]

      const leg = evaluate({ now: fridayMorning, settings: settings({ bookings: [booking('2026-W43', 'outbound', booked)] }), observations }).trips[1]?.legs.outbound

      expect(leg?.booking).toMatchObject({
        train: { trainNumber: '6611', departureTime: '07:10' },
        routeRank: 2,
        inWindow: true,
        minutesFromIdeal: 6,
        durationMinutes: 116,
        candidatesAbove: 1,
      })
      expect(leg?.candidates.slice(0, leg.booking!.candidatesAbove).map(({ train }) => train.trainNumber)).toEqual(['6601'])
    })

    it('rank above every worse candidate, and level with their own train when it still has a seat', () => {
      const booked = train('6601', parisLyonToPartDieu, '2026-10-23', '06:05', '08:01')
      const observations = [
        booked,
        train('6611', parisLyonToPerrache, '2026-10-23', '07:10', '09:06'),
      ]

      const leg = evaluate({ now: fridayMorning, settings: settings({ bookings: [booking('2026-W43', 'outbound', booked)] }), observations }).trips[1]?.legs.outbound

      expect(leg?.booking?.candidatesAbove).toBe(0)
      expect(leg?.candidates.map(({ train }) => train.trainNumber)).toEqual(['6601', '6611'])
    })

    it('rank out of the window with the route weight, as candidates do', () => {
      // Route 1 arrives 60 minutes late; booked route 3 arrives 25 minutes late.
      const booked = train('6631', chessyToPartDieu, '2026-10-23', '08:27', '10:25')
      const observations = [booked, train('6609', parisLyonToPartDieu, '2026-10-23', '09:04', '11:00')]
      const bookings = [booking('2026-W43', 'outbound', booked)]

      const weighed30 = evaluate({ now: fridayMorning, settings: settings({ bookings, routeWeight: 30 }), observations }).trips[1]?.legs.outbound
      const weighed10 = evaluate({ now: fridayMorning, settings: settings({ bookings, routeWeight: 10 }), observations }).trips[1]?.legs.outbound

      expect(weighed30?.booking).toMatchObject({ inWindow: false, minutesOutsideWindow: 25, candidatesAbove: 1 })
      expect(weighed10?.booking?.candidatesAbove).toBe(0)
    })

    it('rank below every candidate once their route is no longer among the leg’s routes', () => {
      const booked = train('8501', { originCode: 'FRPMO', destinationCode: 'FRLPD' }, '2026-10-23', '07:52', '08:58')
      const observations = [
        booked,
        train('6601', parisLyonToPartDieu, '2026-10-23', '06:05', '08:01'),
        train('6631', chessyToPartDieu, '2026-10-23', '09:00', '11:00'),
      ]

      const leg = evaluate({ now: fridayMorning, settings: settings({ bookings: [booking('2026-W43', 'outbound', booked)] }), observations }).trips[1]?.legs.outbound

      expect(leg?.booking).toMatchObject({ train: { trainNumber: '8501' }, routeRank: null, inWindow: true, candidatesAbove: 2 })
      expect(leg?.candidates.map(({ train }) => train.trainNumber)).toEqual(['6601', '6631'])
    })

    it('rank below every candidate when the booked train runs on another day than the leg', () => {
      // Booked on Thursday, then the template moved the outbound leg to Friday.
      const booked = train('6601', parisLyonToPartDieu, '2026-10-22', '06:05', '08:01')
      const observations = [train('6631', chessyToPartDieu, '2026-10-23', '09:00', '11:00')]

      const leg = evaluate({ now: fridayMorning, settings: settings({ bookings: [booking('2026-W43', 'outbound', booked)] }), observations }).trips[1]?.legs.outbound

      expect(leg?.booking).toMatchObject({ train: { date: '2026-10-22' }, candidatesAbove: 1 })
    })

    it('mark their leg as booked, and leave every other leg without one', () => {
      const booked = train('6680', partDieuToParisLyon, '2026-10-25', '17:04', '19:00', false)

      const { trips } = evaluate({ now: fridayMorning, settings: settings({ bookings: [booking('2026-W43', 'return', booked)] }), observations: [] })

      expect(trips[1]?.legs.return).toMatchObject({ status: 'booked', booking: { train: { trainNumber: '6680' } } })
      expect(trips[1]?.legs.outbound).toMatchObject({ status: 'none', booking: null })
      expect(trips[0]?.legs.return.booking).toBeNull()
    })

    it('count as active until their leg has passed', () => {
      const bookings = [
        booking('2026-W42', 'outbound', train('6601', parisLyonToPartDieu, '2026-10-16', '06:05', '08:01')),
        booking('2026-W43', 'outbound', train('6611', parisLyonToPerrache, '2026-10-23', '07:10', '09:06')),
        booking('2026-W43', 'return', train('6680', partDieuToParisLyon, '2026-10-25', '17:04', '19:00')),
      ]

      const friday = evaluate({ now: fridayMorning, settings: settings({ bookings }), observations: [] })
      const saturday = evaluate({ now: new Date('2026-10-17T10:00:00Z'), settings: settings({ bookings }), observations: [] })

      expect(friday.activeBookings).toBe(3)
      expect(saturday.activeBookings).toBe(2)
      expect(evaluate({ now: fridayMorning, settings: settings(), observations: [] }).activeBookings).toBe(0)
    })
  })
})
