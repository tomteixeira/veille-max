import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'
import { saveTemplateLeg } from '#shared/utils/trip-template-store'
import type { SnapshotTrain } from '../../server/snapshots/snapshot-source'
import { loadDashboard } from '../../server/dashboard/dashboard-view'
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
      await runTick({ db: admin, source: fixture.source, now: tick })
    }
  })

  afterAll(async () => {
    await clearSnapshots()
    await Promise.all([traveller, other].map(removeTraveller))
  })

  it('dates the history from the first ingested snapshot, and filters on the trip weekdays by default', async () => {
    const dashboard = await loadDashboard(traveller.client, traveller.id, 'trip')

    expect(dashboard.since).toBe('2026-10-16T04:24:00.000Z')
    expect(dashboard.tripWeekdays).toEqual([FRIDAY, SUNDAY])
    expect(dashboard.filter).toBe('trip')
  })

  it('counts the openings whose start is known by the day before departure they came out, on the traveller’s routes', async () => {
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip')
    const all = await loadDashboard(traveller.client, traveller.id, 'all')

    const counted = (columns: typeof trip.curve.columns) => columns.filter(column => column.openings > 0)
    expect(counted(trip.curve.columns)).toEqual([{ daysBefore: 30, openings: 1 }, { daysBefore: 7, openings: 1 }, { daysBefore: 6, openings: 1 }])
    expect(counted(all.curve.columns)).toEqual([{ daysBefore: 30, openings: 1 }, { daysBefore: 7, openings: 2 }, { daysBefore: 6, openings: 1 }])
    expect(all.curve.peaks).toEqual([30, 7])
  })

  it('gives the share of train-mornings with an open seat per weekday and departure-hour band', async () => {
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip')
    const all = await loadDashboard(traveller.client, traveller.id, 'all')

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
    const trip = await loadDashboard(traveller.client, traveller.id, 'trip')
    const all = await loadDashboard(traveller.client, traveller.id, 'all')

    expect(trip.lifetimes.buckets.map(bucket => bucket.openings)).toEqual([1, 1, 0, 0, 0])
    expect(all.lifetimes.buckets.map(bucket => bucket.openings)).toEqual([2, 1, 0, 0, 0])
  })

  it('is empty, without a start date, before the first snapshot', async () => {
    await clearSnapshots()

    const dashboard = await loadDashboard(traveller.client, traveller.id, 'trip')

    expect(dashboard.since).toBeNull()
    expect(dashboard.curve.total).toBe(0)
    expect(dashboard.slots.best).toBeNull()
    expect(dashboard.lifetimes.total).toBe(0)
  })
})
