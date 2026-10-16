import { describe, expect, it } from 'vitest'
import {
  evaluate,
  type Booking,
  type Evaluation,
  type LegReference,
  type TrainObservation,
  type TravellerSettings,
  type TripMute,
} from '#shared/domain/evaluation'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'

const route1: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const route2: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const route3: Route = { originCode: 'FRMLV', destinationCode: 'FRLPD' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

// Friday 16 October 2026, 06:40 in Paris, just after the morning snapshot.
const fridayMorning = new Date('2026-10-16T04:40:00Z')

// The outbound leg of week 43, Friday 23 October: arrive before 10:00, ideally 09:00, on routes 1, 2 then 3.
const onRoute1 = train('6603', route1, '07:00', '08:56')
const laterOnRoute1 = train('6611', route1, '07:34', '09:30')
const onRoute2 = train('6605', route2, '07:04', '09:00')
const onRoute3 = train('5101', route3, '07:15', '09:10')

function train(trainNumber: string, route: Route, departureTime: string, arrivalTime: string, date = '2026-10-23'): TrainObservation {
  return { date, trainNumber, ...route, departureTime, arrivalTime, open: true }
}

function settings({ mutes, bookings, outboundRoutes = [route1, route2, route3] }: { mutes?: TripMute[], bookings?: Booking[], outboundRoutes?: Route[] } = {}): TravellerSettings {
  const template = defaultTripTemplate()
  return {
    template: {
      outbound: { ...template.outbound, routes: outboundRoutes },
      return: { ...template.return, routes: [partDieuToParisLyon] },
    },
    mutes,
    bookings,
  }
}

function booked(train: TrainObservation): Booking {
  const { open: _open, ...bookedTrain } = train
  return { tripKey: '2026-W43', legKind: 'outbound', train: bookedTrain }
}

/** What the improvements of an evaluation say: « kind train-number », for the outbound leg of week 43. */
function improvementsOf(evaluation: Evaluation): string[] {
  return evaluation.improvements
    .filter(improvement => improvement.tripKey === '2026-W43' && improvement.legKind === 'outbound')
    .map(improvement => `${improvement.kind} ${improvement.candidate.train.trainNumber}`)
}

/**
 * Evaluates one snapshot after another, each time with the references the
 * previous evaluation stored, as the tick does. The settings of each snapshot
 * can change, to mute or unmute. Returns what each snapshot notifies.
 */
function replay(snapshots: { trains: TrainObservation[], settings?: TravellerSettings }[], initial: readonly LegReference[] = []): string[][] {
  let references = initial
  return snapshots.map(({ trains, settings: snapshotSettings = settings() }) => {
    const evaluation = evaluate({ now: fridayMorning, settings: snapshotSettings, observations: trains, references })
    references = evaluation.references
    return improvementsOf(evaluation)
  })
}

describe('improvements', () => {
  it('replay the design scenario: notify on route 3, then on route 1, never on route 2 or a disappearance, again when route 1 reappears', () => {
    expect(replay([
      { trains: [onRoute3] },
      { trains: [onRoute3, onRoute1] },
      { trains: [onRoute3, onRoute1, onRoute2] },
      { trains: [onRoute3, onRoute2] },
      { trains: [onRoute3, onRoute2, onRoute1] },
    ])).toEqual([
      ['first-candidate 5101'],
      ['new-best 6603'],
      [],
      [],
      ['new-best 6603'],
    ])
  })

  it('say nothing while the best candidate stays the same', () => {
    expect(replay([{ trains: [onRoute1] }, { trains: [onRoute1] }])).toEqual([['first-candidate 6603'], []])
  })

  it('count the first candidate again once a leg emptied', () => {
    expect(replay([{ trains: [onRoute1] }, { trains: [] }, { trains: [onRoute2] }])).toEqual([['first-candidate 6603'], [], ['first-candidate 6605']])
  })

  it('come with the new best candidate, its leg and date', () => {
    const { improvements } = evaluate({ now: fridayMorning, settings: settings(), observations: [onRoute1], references: [] })

    expect(improvements).toEqual([{
      tripKey: '2026-W43',
      legKind: 'outbound',
      date: '2026-10-23',
      kind: 'first-candidate',
      candidate: expect.objectContaining({ train: onRoute1, routeRank: 1, inWindow: true }),
    }])
  })

  it('are told for every leg on its own', () => {
    const back = train('6680', partDieuToParisLyon, '17:04', '19:00', '2026-10-25')
    const nextWeek = train('6603', route1, '07:00', '08:56', '2026-10-30')

    const { improvements } = evaluate({ now: fridayMorning, settings: settings(), observations: [onRoute1, back, nextWeek], references: [] })

    expect(improvements.map(({ tripKey, legKind, kind }) => `${tripKey} ${legKind} ${kind}`)).toEqual([
      '2026-W43 outbound first-candidate',
      '2026-W43 return first-candidate',
      '2026-W44 outbound first-candidate',
    ])
  })

  describe('references', () => {
    it('are each tracked leg’s best candidate, without its seat, or nothing when it has none', () => {
      const { references } = evaluate({ now: fridayMorning, settings: settings(), observations: [onRoute2, onRoute1], references: [] })
      const { open: _open, ...bestTrain } = onRoute1

      expect(references).toContainEqual({ tripKey: '2026-W43', legKind: 'outbound', train: bestTrain })
      expect(references).toContainEqual({ tripKey: '2026-W43', legKind: 'return', train: null })
      expect(references.map(reference => reference.tripKey)).not.toContain('2026-W48')
    })

    it('leave out the legs that have passed', () => {
      // Saturday 17 October: the outbound leg of week 42 has passed, its return leg has not.
      const { references } = evaluate({ now: new Date('2026-10-17T10:00:00Z'), settings: settings(), observations: [], references: [] })

      expect(references.filter(reference => reference.tripKey === '2026-W42').map(reference => reference.legKind)).toEqual(['return'])
    })

    it('are ranked with the leg’s current settings: one whose route was removed ranks below every candidate', () => {
      const { open: _open, ...onRoute3Train } = onRoute3
      const reference: LegReference = { tripKey: '2026-W43', legKind: 'outbound', train: onRoute3Train }

      const evaluation = evaluate({ now: fridayMorning, settings: settings({ outboundRoutes: [route1, route2] }), observations: [onRoute2], references: [reference] })

      expect(improvementsOf(evaluation)).toEqual(['new-best 6605'])
    })

    it('silence a leg once stored after a settings change: they are its current best candidate', () => {
      const before = evaluate({ now: fridayMorning, settings: settings(), observations: [onRoute1, onRoute3], references: [] })
      // The traveller ranks route 3 first: its train becomes the best candidate, the reference is reset to it.
      const changed = settings({ outboundRoutes: [route3, route1, route2] })
      const reset = evaluate({ now: fridayMorning, settings: changed, observations: [onRoute1, onRoute3], references: before.references })

      const next = evaluate({ now: fridayMorning, settings: changed, observations: [onRoute1, onRoute3], references: reset.references })

      expect(improvementsOf(next)).toEqual([])
    })
  })

  describe('on a booked leg', () => {
    it('are only the candidates strictly better than the booking', () => {
      const bookings = [booked(laterOnRoute1)]

      expect(replay([
        // The booked train still shows a seat, and worse trains appear.
        { trains: [laterOnRoute1, onRoute2], settings: settings({ bookings }) },
        { trains: [laterOnRoute1, onRoute2, onRoute3], settings: settings({ bookings }) },
        { trains: [laterOnRoute1, onRoute2, onRoute3, onRoute1], settings: settings({ bookings }) },
      ])).toEqual([[], [], ['better-than-booking 6603']])
    })

    it('say nothing of a first candidate worse than the booking', () => {
      expect(replay([{ trains: [onRoute3], settings: settings({ bookings: [booked(onRoute2)] }) }])).toEqual([[]])
    })

    it('tell a candidate better than the booking even when it is the leg’s first', () => {
      expect(replay([{ trains: [onRoute1], settings: settings({ bookings: [booked(onRoute2)] }) }])).toEqual([['better-than-booking 6603']])
    })

    it('measure against the previous best candidate when it ranks above the booking', () => {
      const bookings = [booked(onRoute3)]

      expect(replay([
        { trains: [onRoute2], settings: settings({ bookings }) },
        { trains: [onRoute2, laterOnRoute1], settings: settings({ bookings }) },
        { trains: [laterOnRoute1, onRoute1], settings: settings({ bookings }) },
      ])).toEqual([['better-than-booking 6605'], ['new-best 6611'], ['new-best 6603']])
    })

    it('do not come back when the booked train is the best candidate again', () => {
      const bookings = [booked(onRoute1)]

      expect(replay([
        { trains: [onRoute2] },
        { trains: [onRoute2, onRoute1], settings: settings({ bookings }) },
      ])).toEqual([['first-candidate 6605'], []])
    })
  })

  describe('on a muted leg', () => {
    const mutedLeg = settings({ mutes: [{ tripKey: '2026-W43', leg: 'outbound' }] })
    const mutedTrip = settings({ mutes: [{ tripKey: '2026-W43' }] })

    it('are never told, for a muted leg or a muted trip', () => {
      expect(replay([{ trains: [onRoute3], settings: mutedLeg }, { trains: [onRoute3, onRoute1], settings: mutedLeg }])).toEqual([[], []])
      expect(replay([{ trains: [onRoute3], settings: mutedTrip }, { trains: [onRoute3, onRoute1], settings: mutedTrip }])).toEqual([[], []])
    })

    it('still update its reference, so unmuting does not flood the traveller', () => {
      expect(replay([
        { trains: [onRoute3], settings: mutedLeg },
        { trains: [onRoute3, onRoute1], settings: mutedLeg },
        { trains: [onRoute3, onRoute1, onRoute2] },
        { trains: [onRoute3, onRoute2] },
        { trains: [onRoute3, onRoute2, onRoute1] },
      ])).toEqual([[], [], [], [], ['new-best 6603']])
    })

    it('leave the trip’s other leg notified', () => {
      const back = train('6680', partDieuToParisLyon, '17:04', '19:00', '2026-10-25')

      const { improvements } = evaluate({ now: fridayMorning, settings: mutedLeg, observations: [onRoute1, back], references: [] })

      expect(improvements.filter(improvement => improvement.tripKey === '2026-W43').map(improvement => improvement.legKind)).toEqual(['return'])
    })
  })
})
