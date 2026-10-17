import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'
import { saveBooking } from '#shared/utils/booking-store'
import { saveTemplateLeg } from '#shared/utils/trip-template-store'
import type { SnapshotTrain } from '../../server/snapshots/snapshot-source'
import { loadDashboard, loadLegHistory } from '../../server/dashboard/dashboard-view'
import { runTick } from '../../server/tick/run-tick'
import { clearSnapshots, fixtureSnapshotSource } from './support/snapshots'
import { admin, removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }
// Another traveller's route: never on our traveller's dashboard.
const montparnasseToBordeaux: Route = { originCode: 'FRPMO', destinationCode: 'FRBOJ' }

const FRIDAY = 5
const SATURDAY = 6
const SUNDAY = 7

// Wednesday 21 October 2026, after the five mornings; Tuesday 27, once the weekend of the 23rd has passed.
const wednesday = new Date('2026-10-21T10:00:00Z')
const nextTuesday = new Date('2026-10-27T10:00:00Z')

function train(trainNumber: string, route: Route, date: string, departureTime: string, open: boolean): SnapshotTrain {
  return { date, trainNumber, ...route, departureTime, arrivalTime: '23:00', open }
}

// The trains of the next weekend, as five successive morning snapshots list them.
const fridayEarly = (open: boolean) => train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', open)
const fridayEvening = (open: boolean) => train('6641', parisLyonToPartDieu, '2026-10-23', '18:00', open)
const saturdayMorning = (open: boolean) => train('6609', parisLyonToPartDieu, '2026-10-24', '09:00', open)
const sundayEvening = (open: boolean) => train('6680', partDieuToParisLyon, '2026-10-25', '17:04', open)
// First listed on Sunday 18 with its seat already open, as when a route starts being tracked: when it came out is unknown.
const sundayLate = (open: boolean) => train('6690', partDieuToParisLyon, '2026-10-25', '21:00', open)
// Listed from the first snapshot, 30 days ahead: its date just entered the booking window, its seat came out then.
const horizonSunday = (open: boolean) => train('6672', partDieuToParisLyon, '2026-11-15', '10:00', open)
const elsewhere = (open: boolean) => train('8501', montparnasseToBordeaux, '2026-10-23', '07:52', open)

/** Snapshot of the Paris morning `day` (October 2026), taken at 06:24 and ingested at 06:30. */
function morning(day: number, trains: SnapshotTrain[]) {
  const date = `2026-10-${String(day).padStart(2, '0')}`
  return { snapshot: { processedAt: new Date(`${date}T04:24:00Z`), trains }, tick: new Date(`${date}T04:30:00Z`) }
}

const mornings = [
  // Friday 16: the first snapshot. The early Friday train is already open: when its seat came out is unknown.
  // The Sunday seat 30 days ahead comes out at D-30.
  morning(16, [fridayEarly(true), fridayEvening(false), saturdayMorning(false), sundayEvening(false), horizonSunday(true), elsewhere(false)]),
  // Saturday 17: the Friday evening seat comes out at D-6, the Saturday one at D-7, another traveller's at D-6.
  // The seat 30 days ahead is taken, after 0 day.
  morning(17, [fridayEarly(true), fridayEvening(true), saturdayMorning(true), sundayEvening(false), horizonSunday(false), elsewhere(true)]),
  // Sunday 18: the early Friday seat and the Saturday seat (after 0 day) are taken; the Sunday seat comes out at D-7.
  morning(18, [fridayEarly(false), fridayEvening(true), saturdayMorning(false), sundayEvening(true), sundayLate(true), horizonSunday(false), elsewhere(true)]),
  // Monday 19: the Friday evening seat is taken, after 1 day. The late Sunday seat is taken too, but its start is unknown.
  morning(19, [fridayEarly(false), fridayEvening(false), saturdayMorning(false), sundayEvening(true), sundayLate(false), horizonSunday(false), elsewhere(false)]),
  // Tuesday 20: the Sunday train leaves the dataset: its seat was not seen taken.
  morning(20, [fridayEarly(false), fridayEvening(false), saturdayMorning(false), sundayLate(false), horizonSunday(false), elsewhere(false)]),
]

describe('dashboard: when seats come out', () => {
  let traveller: Traveller
  let other: Traveller

  beforeAll(async () => {
    ;[traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
    // Friday out, Sunday back.
    const { outbound, return: ret } = defaultTripTemplate()
    await saveTemplateLeg(traveller.client, 'outbound', { ...outbound, routes: [parisLyonToPartDieu] })
    await saveTemplateLeg(traveller.client, 'return', { ...ret, routes: [partDieuToParisLyon] })
    await saveTemplateLeg(other.client, 'outbound', { ...outbound, routes: [montparnasseToBordeaux] })

    await clearSnapshots()
    const fixture = fixtureSnapshotSource(mornings[0]!.snapshot)
    for (const { snapshot, tick } of mornings) {
      fixture.publish(snapshot)
      await runTick({ db: admin, source: fixture.source, gateway: null, now: tick })
    }
  })

  afterAll(async () => {
    await clearSnapshots()
    await Promise.all([traveller, other].map(removeTraveller))
  })

  it('dates the history from the first ingested snapshot, and filters on the trip weekdays by default', async () => {
    const dashboard = await loadDashboard(traveller.client, traveller.id, 'trip', wednesday)

    expect(dashboard.since).toBe('2026-10-16T04:24:00.000Z')
    expect(dashboard.tripWeekdays).toEqual([FRIDAY, SUNDAY])
    expect(dashboard.filter).toBe('trip')
  })

  it('counts the openings whose start is known by the day before departure they came out, on the traveller’s routes', async () => {
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip', wednesday)
    const all = await loadDashboard(traveller.client, traveller.id, 'all', wednesday)

    const counted = (columns: typeof trip.curve.columns) => columns.filter(column => column.openings > 0)
    expect(counted(trip.curve.columns)).toEqual([{ daysBefore: 30, openings: 1 }, { daysBefore: 7, openings: 1 }, { daysBefore: 6, openings: 1 }])
    expect(counted(all.curve.columns)).toEqual([{ daysBefore: 30, openings: 1 }, { daysBefore: 7, openings: 2 }, { daysBefore: 6, openings: 1 }])
    expect(all.curve.peaks).toEqual([30, 7])
  })

  it('gives the share of train-mornings with an open seat per weekday and departure-hour band', async () => {
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip', wednesday)
    const all = await loadDashboard(traveller.client, traveller.id, 'all', wednesday)

    // Friday 07:00: open 2 mornings out of 5; Friday 18:00: 2 out of 5.
    // Sunday 10:00: 1 out of 5; Sunday 17:04: 2 out of 4; Sunday 21:00: 1 out of 3.
    expect(trip.slots.rows).toEqual([
      { weekday: FRIDAY, percents: [40, null, null, null, 40, null] },
      { weekday: SUNDAY, percents: [null, 20, null, null, 50, 33] },
    ])
    expect(trip.slots.best).toEqual({ weekday: SUNDAY, bandIndex: 4, percent: 50 })
    // Saturday 09:00: open 1 morning out of 5.
    expect(all.slots.rows.find(row => row.weekday === SATURDAY)?.percents).toEqual([null, 20, null, null, null, null])
  })

  it('spreads the seats seen taken by how long they lasted', async () => {
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip', wednesday)
    const all = await loadDashboard(traveller.client, traveller.id, 'all', wednesday)

    expect(trip.lifetimes.buckets.map(bucket => bucket.openings)).toEqual([1, 1, 0, 0, 0])
    expect(all.lifetimes.buckets.map(bucket => bucket.openings)).toEqual([2, 1, 0, 0, 0])
  })

  describe('leg history', () => {
    it('lists the legs of the tracked trips and of the trips archived since the first snapshot', async () => {
      const { legs } = await loadDashboard(traveller.client, traveller.id, 'trip', nextTuesday)

      expect(legs.slice(0, 5)).toEqual([
        { tripKey: '2026-W42', kind: 'outbound', date: '2026-10-16', past: true },
        { tripKey: '2026-W42', kind: 'return', date: '2026-10-18', past: true },
        { tripKey: '2026-W43', kind: 'outbound', date: '2026-10-23', past: true },
        { tripKey: '2026-W43', kind: 'return', date: '2026-10-25', past: true },
        { tripKey: '2026-W44', kind: 'outbound', date: '2026-10-30', past: false },
      ])
    })

    it('gives the number of candidates and the best one in every snapshot of the leg’s booking window', async () => {
      const history = await loadLegHistory(traveller.client, traveller.id, wednesday, '2026-W43', 'outbound')

      // Both Friday trains arrive at 23:00, out of the window: the earlier one ranks first.
      expect(history?.columns.map(({ day, daysBefore, candidates, best }) => [day, daysBefore, candidates, best?.train.trainNumber ?? null])).toEqual([
        ['2026-10-16', 7, 1, '6603'],
        ['2026-10-17', 6, 2, '6603'],
        ['2026-10-18', 5, 1, '6641'],
        ['2026-10-19', 4, 0, null],
        ['2026-10-20', 3, 0, null],
      ])
      expect(history).toMatchObject({ tripKey: '2026-W43', kind: 'outbound', date: '2026-10-23', past: false, settings: { routes: [parisLyonToPartDieu] } })
      expect(history?.stationNames).toMatchObject({ FRPLY: expect.any(String), FRLPD: expect.any(String) })
    })

    it('keeps the history of a leg once its trip is archived', async () => {
      const history = await loadLegHistory(traveller.client, traveller.id, nextTuesday, '2026-W43', 'return')

      // The Sunday seats: 6680 from the 18th to the 19th, 6690 (later, further from 17:00) on the 18th.
      expect(history?.past).toBe(true)
      expect(history?.columns.map(({ candidates, best }) => [candidates, best?.train.trainNumber ?? null])).toEqual([
        [0, null],
        [0, null],
        [2, '6680'],
        [1, '6680'],
        [0, null],
      ])
    })

    it('is not found for a trip outside the history', async () => {
      expect(await loadLegHistory(traveller.client, traveller.id, wednesday, '2026-W30', 'outbound')).toBeNull()
    })
  })

  it('counts the bookings held against the limit, and how long before departure they were declared', async () => {
    await saveBooking(traveller.client, traveller.id, { tripKey: '2026-W43', legKind: 'outbound', train: fridayEvening(true) })
    await saveBooking(traveller.client, traveller.id, { tripKey: '2026-W43', legKind: 'return', train: sundayEvening(true) })
    await saveBooking(traveller.client, traveller.id, { tripKey: '2026-W46', legKind: 'return', train: horizonSunday(true) })
    // Declared on Saturday 17 (D-6), Sunday 18 (D-7) and Friday 16 (D-30).
    for (const [legKind, tripKey, bookedAt] of [['outbound', '2026-W43', '2026-10-17T08:00:00Z'], ['return', '2026-W43', '2026-10-18T08:00:00Z'], ['return', '2026-W46', '2026-10-16T08:00:00Z']] as const) {
      const { error } = await admin.from('bookings').update({ booked_at: bookedAt }).eq('user_id', traveller.id).eq('trip_key', tripKey).eq('leg_kind', legKind)
      expect(error).toBeNull()
    }

    const { bookings } = await loadDashboard(traveller.client, traveller.id, 'trip', nextTuesday)

    expect(bookings.active).toBe(1)
    // (6 + 7 + 30) / 3.
    expect(bookings.averageDaysBefore).toBe(14)
    expect(bookings.past.map(({ tripKey, legKind, daysBefore }) => [tripKey, legKind, daysBefore])).toEqual([['2026-W43', 'return', 7], ['2026-W43', 'outbound', 6]])
  })

  it('is empty, without a start date, before the first snapshot', async () => {
    await clearSnapshots()

    const dashboard = await loadDashboard(traveller.client, traveller.id, 'trip', wednesday)

    expect(dashboard.since).toBeNull()
    expect(dashboard.curve.total).toBe(0)
    expect(dashboard.slots.best).toBeNull()
    expect(dashboard.lifetimes.total).toBe(0)
  })
})
