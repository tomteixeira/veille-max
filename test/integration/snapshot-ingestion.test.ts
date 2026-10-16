import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'
import { saveTemplateLeg } from '#shared/utils/trip-template-store'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import { saveCustomisedTrip } from '#shared/utils/trip-store'
import type { SnapshotTrain } from '../../server/snapshots/snapshot-source'
import { runTick } from '../../server/tick/run-tick'
import { clearSnapshots, fixtureSnapshotSource, observations, openings } from './support/snapshots'
import { admin, removeTraveller, signedInTraveller, signedOutClient, type Traveller } from './support/travellers'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

// Postgres error code.
const INSUFFICIENT_PRIVILEGE = '42501'

// Snapshots SNCF takes at 06:24 Paris, ingested at the next tick.
const friday = { processedAt: new Date('2026-10-16T04:24:09Z'), tick: new Date('2026-10-16T04:30:00Z') }
const saturday = { processedAt: new Date('2026-10-17T04:24:11Z'), tick: new Date('2026-10-17T04:30:00Z') }
const sunday = { processedAt: new Date('2026-10-18T04:24:07Z'), tick: new Date('2026-10-18T04:30:00Z') }

function train(trainNumber: string, route: Route, date: string, departureTime: string, arrivalTime: string, open: boolean): SnapshotTrain {
  return { date, trainNumber, ...route, departureTime, arrivalTime, open }
}

// The next trip's trains on the tracked routes, as the morning snapshots list them.
const morning6603 = (open: boolean) => train('6603', parisLyonToPartDieu, '2026-10-23', '07:00', '08:56', open)
const morning6605 = (open: boolean) => train('6605', parisLyonToPartDieu, '2026-10-23', '08:00', '09:56', open)
const evening6680 = (open: boolean) => train('6680', partDieuToParisLyon, '2026-10-25', '17:04', '19:00', open)
// Trains the snapshots list but the ingestion must not collect.
const untrackedRoute = train('8501', { originCode: 'FRPMO', destinationCode: 'FRBOJ' }, '2026-10-23', '07:52', '09:58', true)
const beyondHorizon = train('6603', parisLyonToPartDieu, '2026-11-16', '07:00', '08:56', true)

describe('snapshot ingestion through the tick', () => {
  let travellers: Traveller[]

  beforeAll(async () => {
    travellers = await Promise.all([signedInTraveller(), signedInTraveller()])
    const [first, second] = travellers as [Traveller, Traveller]
    const { outbound, return: ret } = defaultTripTemplate()
    // Both travellers rank Paris Gare de Lyon → Part-Dieu: it is collected once.
    await saveTemplateLeg(first.client, 'outbound', { ...outbound, routes: [parisLyonToPartDieu] })
    await saveTemplateLeg(second.client, 'outbound', { ...outbound, routes: [parisLyonToPerrache, parisLyonToPartDieu] })
    await saveTemplateLeg(second.client, 'return', { ...ret, routes: [partDieuToParisLyon] })
  })

  afterAll(async () => {
    await clearSnapshots()
    await Promise.all(travellers.map(removeTraveller))
  })

  beforeEach(clearSnapshots)

  it('collects every traveller’s template routes, once each, from today to D+30 in Paris', async () => {
    const fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [] })

    // 23:30 UTC on Thursday is already Friday in Paris.
    await runTick({ db: admin, source: fixture.source, now: new Date('2026-10-15T23:30:00Z') })

    const [{ routes, dates }] = fixture.exports as [typeof fixture.exports[number]]
    expect(dates).toEqual({ from: '2026-10-16', to: '2026-11-15' })
    expect(routes).toEqual(expect.arrayContaining([parisLyonToPartDieu, parisLyonToPerrache, partDieuToParisLyon]))
    const keys = routes.map(route => `${route.originCode}→${route.destinationCode}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('records a first snapshot: its trains on the tracked routes, and an opening for each open seat', async () => {
    const fixture = fixtureSnapshotSource({
      processedAt: friday.processedAt,
      trains: [morning6603(true), morning6605(false), evening6680(true), untrackedRoute, beyondHorizon],
    })

    const summary = await runTick({ db: admin, source: fixture.source, now: friday.tick })

    expect(summary).toEqual({
      ingested: true,
      snapshotId: expect.any(Number),
      counts: { trains: 3, openTrains: 2, openingsOpened: 2, openingsKept: 0, openingsClosed: 0 },
    })
    const s1 = summary.snapshotId
    expect(await observations()).toEqual([
      { travel_date: '2026-10-23', train_number: '6603', origin_code: 'FRPLY', destination_code: 'FRLPD', departure_time: '07:00:00', arrival_time: '08:56:00', first_snapshot_id: s1, last_snapshot_id: s1 },
      { travel_date: '2026-10-23', train_number: '6605', origin_code: 'FRPLY', destination_code: 'FRLPD', departure_time: '08:00:00', arrival_time: '09:56:00', first_snapshot_id: s1, last_snapshot_id: s1 },
      { travel_date: '2026-10-25', train_number: '6680', origin_code: 'FRLPD', destination_code: 'FRPLY', departure_time: '17:04:00', arrival_time: '19:00:00', first_snapshot_id: s1, last_snapshot_id: s1 },
    ])
    expect(await openings()).toEqual([
      { train: '2026-10-23 6603 FRPLY→FRLPD', first_snapshot_id: s1, last_snapshot_id: s1, is_open: true },
      { train: '2026-10-25 6680 FRLPD→FRPLY', first_snapshot_id: s1, last_snapshot_id: s1, is_open: true },
    ])
  })

  it('keeps, opens and closes openings across successive snapshots', async () => {
    const fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [morning6603(true), morning6605(false), evening6680(true)] })
    const { snapshotId: s1 } = await runTick({ db: admin, source: fixture.source, now: friday.tick })

    // Saturday: 6603 is still open, 6605 opens, 6680 is gone.
    fixture.publish({ processedAt: saturday.processedAt, trains: [morning6603(true), morning6605(true), evening6680(false)] })
    const second = await runTick({ db: admin, source: fixture.source, now: saturday.tick })

    expect(second.counts).toEqual({ trains: 3, openTrains: 2, openingsOpened: 1, openingsKept: 1, openingsClosed: 1 })
    const s2 = second.snapshotId
    expect(await openings()).toEqual([
      { train: '2026-10-23 6603 FRPLY→FRLPD', first_snapshot_id: s1, last_snapshot_id: s2, is_open: true },
      { train: '2026-10-25 6680 FRLPD→FRPLY', first_snapshot_id: s1, last_snapshot_id: s1, is_open: false },
      { train: '2026-10-23 6605 FRPLY→FRLPD', first_snapshot_id: s2, last_snapshot_id: s2, is_open: true },
    ])
    expect((await observations()).map(({ train_number, first_snapshot_id, last_snapshot_id }) => ({ train_number, first_snapshot_id, last_snapshot_id }))).toEqual([
      { train_number: '6603', first_snapshot_id: s1, last_snapshot_id: s2 },
      { train_number: '6605', first_snapshot_id: s1, last_snapshot_id: s2 },
      { train_number: '6680', first_snapshot_id: s1, last_snapshot_id: s2 },
    ])

    // Sunday: 6680 opens again, a new opening; 6603 leaves the snapshot, its opening closes.
    fixture.publish({ processedAt: sunday.processedAt, trains: [morning6605(true), evening6680(true)] })
    const third = await runTick({ db: admin, source: fixture.source, now: sunday.tick })

    expect(third.counts).toEqual({ trains: 2, openTrains: 2, openingsOpened: 1, openingsKept: 1, openingsClosed: 1 })
    const s3 = third.snapshotId
    expect(await openings()).toEqual([
      { train: '2026-10-23 6603 FRPLY→FRLPD', first_snapshot_id: s1, last_snapshot_id: s2, is_open: false },
      { train: '2026-10-25 6680 FRLPD→FRPLY', first_snapshot_id: s1, last_snapshot_id: s1, is_open: false },
      { train: '2026-10-23 6605 FRPLY→FRLPD', first_snapshot_id: s2, last_snapshot_id: s3, is_open: true },
      { train: '2026-10-25 6680 FRLPD→FRPLY', first_snapshot_id: s3, last_snapshot_id: s3, is_open: true },
    ])
  })

  it('does nothing when SNCF still publishes the snapshot it last ingested', async () => {
    const fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [morning6603(true), evening6680(true)] })
    const first = await runTick({ db: admin, source: fixture.source, now: friday.tick })
    const before = { observations: await observations(), openings: await openings() }

    // A later tick, the same morning: SNCF has not published a new snapshot.
    fixture.publish({ processedAt: friday.processedAt, trains: [morning6603(false), evening6680(false)] })
    const again = await runTick({ db: admin, source: fixture.source, now: new Date('2026-10-16T04:45:00Z') })

    expect(again).toEqual({ ingested: false, snapshotId: first.snapshotId, counts: null })
    expect(fixture.exports).toHaveLength(1)
    expect({ observations: await observations(), openings: await openings() }).toEqual(before)
    const { count } = await admin.from('snapshots').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  it('shows signed-in travellers when the last snapshot was taken, and nobody else', async () => {
    const fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [morning6603(true)] })
    expect(await loadLastSnapshot(travellers[0]!.client)).toBeNull()

    await runTick({ db: admin, source: fixture.source, now: friday.tick })
    fixture.publish({ processedAt: saturday.processedAt, trains: [morning6603(true)] })
    await runTick({ db: admin, source: fixture.source, now: saturday.tick })

    expect(await loadLastSnapshot(travellers[0]!.client)).toEqual({ id: expect.any(Number), processedAt: saturday.processedAt })
    for (const table of ['snapshots', 'train_observations', 'openings'] as const) {
      const { data, error } = await signedOutClient().from(table).select()
      expect(data, table).toBeNull()
      expect(error, table).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    }
    const write = await travellers[0]!.client.from('snapshots')
      .insert({ processed_at: sunday.processedAt.toISOString(), ingested_at: sunday.tick.toISOString(), row_count: 0, open_count: 0 })
    expect(write.error).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
  })
})

describe('snapshot ingestion of customised trips', () => {
  const parisLyonToMarseille: Route = { originCode: 'FRPLY', destinationCode: 'FRMSC' }
  const marseilleToParisLyon: Route = { originCode: 'FRMSC', destinationCode: 'FRPLY' }
  const bordeauxToMontpellier: Route = { originCode: 'FRBOJ', destinationCode: 'FRMPL' }
  const { outbound, return: ret } = defaultTripTemplate()
  let traveller: Traveller

  beforeAll(async () => {
    traveller = await signedInTraveller()
    await saveTemplateLeg(traveller.client, 'outbound', { ...outbound, routes: [parisLyonToPartDieu] })
    // Inside the horizon of Friday 16 October: week 43, to Marseille, leaving on Thursday.
    await saveCustomisedTrip(traveller.client, '2026-W43', {
      outbound: { ...outbound, date: '2026-10-22', routes: [parisLyonToMarseille] },
      return: { ...ret, date: '2026-10-25', routes: [marseilleToParisLyon] },
    })
    // Beyond it: week 50, from Bordeaux to Montpellier.
    await saveCustomisedTrip(traveller.client, '2026-W50', {
      outbound: { ...outbound, date: '2026-12-11', routes: [bordeauxToMontpellier] },
      return: { ...ret, date: '2026-12-13', routes: [] },
    })
  })

  afterAll(async () => {
    await clearSnapshots()
    await removeTraveller(traveller)
  })

  beforeEach(clearSnapshots)

  it('collects the routes of the customised trips in the horizon, as well as the template routes', async () => {
    const fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [] })

    await runTick({ db: admin, source: fixture.source, now: friday.tick })

    const [{ routes }] = fixture.exports as [typeof fixture.exports[number]]
    expect(routes).toEqual(expect.arrayContaining([parisLyonToPartDieu, parisLyonToMarseille, marseilleToParisLyon]))
    expect(routes).not.toContainEqual(bordeauxToMontpellier)
  })

  it('records the trains of a customised route', async () => {
    const fixture = fixtureSnapshotSource({
      processedAt: friday.processedAt,
      trains: [train('6177', parisLyonToMarseille, '2026-10-22', '19:07', '22:24', true)],
    })

    const summary = await runTick({ db: admin, source: fixture.source, now: friday.tick })

    expect(summary.counts).toMatchObject({ trains: 1, openTrains: 1, openingsOpened: 1 })
    const { data } = await admin.from('train_observations').select('train_number, travel_date').eq('origin_code', 'FRPLY').eq('destination_code', 'FRMSC')
    expect(data).toEqual([{ train_number: '6177', travel_date: '2026-10-22' }])
  })
})
