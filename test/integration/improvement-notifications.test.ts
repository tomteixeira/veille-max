import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultTripTemplate, type Route } from '#shared/domain/trip-template'
import { registerPushDevice } from '#shared/utils/push-device-store'
import { setMute } from '#shared/utils/trip-store'
import { saveTemplateLeg } from '#shared/utils/trip-template-store'
import { loadHomeView } from '../../server/evaluation/home-view'
import { resetLegReferences } from '../../server/improvements/reset-leg-references'
import type { SnapshotTrain } from '../../server/snapshots/snapshot-source'
import { runTick } from '../../server/tick/run-tick'
import { recordingPushGateway } from './support/push-gateway'
import { clearSnapshots, fixtureSnapshotSource, type FixtureSnapshot } from './support/snapshots'
import { admin, removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }

// Snapshots SNCF takes at 06:24 Paris, ingested at the next tick.
const friday = { processedAt: new Date('2026-10-16T04:24:09Z'), tick: new Date('2026-10-16T04:30:00Z') }
const saturday = { processedAt: new Date('2026-10-17T04:24:11Z'), tick: new Date('2026-10-17T04:30:00Z') }
const sunday = { processedAt: new Date('2026-10-18T04:24:07Z'), tick: new Date('2026-10-18T04:30:00Z') }

// Trains of the outbound leg of week 43, Friday 23 October: arrive before 10:00, ideally 09:00.
function train(trainNumber: string, route: Route, departureTime: string, arrivalTime: string): SnapshotTrain {
  return { date: '2026-10-23', trainNumber, ...route, departureTime, arrivalTime, open: true }
}
const toPartDieu = train('6603', parisLyonToPartDieu, '07:00', '08:56')
const toPerrache = train('6605', parisLyonToPerrache, '07:04', '09:00')

/** Turns notifications on for `traveller` on a new device, and returns its subscription endpoint. */
async function turnOnDevice(traveller: Traveller, deviceLabel: string): Promise<string> {
  const endpoint = `https://push.example.test/${randomUUID()}`
  await registerPushDevice(traveller.client, { endpoint, p256dh: 'p256dh-key', auth: 'auth-secret', deviceLabel })
  return endpoint
}

/** Ranks `routes` on the outbound leg of `traveller`'s trip template. */
async function rankOutbound(traveller: Traveller, routes: Route[]): Promise<void> {
  await saveTemplateLeg(traveller.client, 'outbound', { ...defaultTripTemplate().outbound, routes })
}

describe('improvement notifications through the tick', () => {
  let traveller: Traveller
  let other: Traveller
  let devices: { iPhone: string, mac: string, other: string }
  let gateway: ReturnType<typeof recordingPushGateway>
  let fixture: ReturnType<typeof fixtureSnapshotSource>

  /** Publishes `trains` as the snapshot of `day`, runs the tick, and returns the pushes it sent. */
  async function snapshot(day: typeof friday, trains: SnapshotTrain[]) {
    const published: FixtureSnapshot = { processedAt: day.processedAt, trains }
    fixture.publish(published)
    const sentBefore = gateway.sent.length
    const summary = await runTick({ db: admin, source: fixture.source, gateway, now: day.tick })
    return { summary, sent: gateway.sent.slice(sentBefore) }
  }

  beforeEach(async () => {
    await clearSnapshots()
    ;[traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
    await Promise.all([rankOutbound(traveller, [parisLyonToPartDieu, parisLyonToPerrache]), rankOutbound(other, [parisLyonToPartDieu])])
    devices = {
      iPhone: await turnOnDevice(traveller, 'iPhone'),
      mac: await turnOnDevice(traveller, 'Mac'),
      other: await turnOnDevice(other, 'iPhone'),
    }
    gateway = recordingPushGateway()
    fixture = fixtureSnapshotSource({ processedAt: friday.processedAt, trains: [] })
  })

  afterEach(async () => {
    await clearSnapshots()
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('notifies each improved leg on every device of its traveller, in French, opening the leg', async () => {
    const { sent, summary } = await snapshot(friday, [toPerrache])

    expect(sent.filter(push => push.endpoint !== devices.other)).toEqual([
      { endpoint: devices.iPhone, message: { title: 'Premier train pour l’aller du vendredi 23 octobre', body: '07:04 Paris Gare de Lyon → 09:00 Lyon Perrache', url: '/trips/2026-W43/outbound' } },
      { endpoint: devices.mac, message: { title: 'Premier train pour l’aller du vendredi 23 octobre', body: '07:04 Paris Gare de Lyon → 09:00 Lyon Perrache', url: '/trips/2026-W43/outbound' } },
    ])
    // The other traveller does not rank Perrache: nothing for them.
    expect(sent.map(push => push.endpoint)).not.toContain(devices.other)
    expect(summary.improvements).toMatchObject({ snapshotId: summary.snapshotId, improvements: 1, delivered: 2, gone: 0, failed: 0 })
  })

  it('replays a sequence of snapshots: a new best notifies, a worse train or a disappearance does not', async () => {
    const pushes = async (day: typeof friday, trains: SnapshotTrain[]) =>
      (await snapshot(day, trains)).sent.filter(push => push.endpoint === devices.iPhone).map(push => push.message.title)

    expect(await pushes(friday, [toPartDieu])).toEqual(['Premier train pour l’aller du vendredi 23 octobre'])
    expect(await pushes(saturday, [toPartDieu, toPerrache])).toEqual([])
    expect(await pushes(sunday, [toPerrache])).toEqual([])
    expect(await pushes({ processedAt: new Date('2026-10-19T04:24:00Z'), tick: new Date('2026-10-19T04:30:00Z') }, [toPerrache, toPartDieu]))
      .toEqual(['Meilleur train pour l’aller du vendredi 23 octobre'])
  })

  it('sends nothing new when the tick runs again for the same snapshot', async () => {
    await snapshot(friday, [toPartDieu])

    const again = await snapshot({ ...friday, tick: new Date('2026-10-16T04:45:00Z') }, [toPartDieu])

    expect(again.sent).toEqual([])
    expect(again.summary.improvements).toBeNull()
  })

  it('sends nothing twice when a tick stopped before storing the references: the notification log remembers', async () => {
    const first = await snapshot(friday, [toPartDieu])
    expect(first.sent).toHaveLength(3)
    // As if the tick had stopped after sending, before storing the references and stamping the snapshot.
    await admin.from('snapshots').update({ evaluated_at: null }).eq('id', first.summary.snapshotId!)
    await admin.from('leg_references').delete().in('user_id', [traveller.id, other.id])

    const again = await snapshot({ ...friday, tick: new Date('2026-10-16T04:45:00Z') }, [toPartDieu])

    expect(again.sent).toEqual([])
    expect(again.summary.improvements).toMatchObject({ improvements: 0 })
  })

  it('never notifies a muted trip, and does not flood its traveller once unmuted', async () => {
    await setMute(other.client, { tripKey: '2026-W43' }, true)

    const muted = await snapshot(friday, [toPartDieu])
    await setMute(other.client, { tripKey: '2026-W43' }, false)
    const unmuted = await snapshot(saturday, [toPartDieu])

    expect(muted.sent.map(push => push.endpoint)).toEqual([devices.iPhone, devices.mac])
    expect(unmuted.sent).toEqual([])
  })

  it('never notifies a muted leg', async () => {
    await setMute(traveller.client, { tripKey: '2026-W43', leg: 'outbound' }, true)

    const { sent } = await snapshot(friday, [toPartDieu])

    expect(sent.map(push => push.endpoint)).toEqual([devices.other])
  })

  it('resets the references after a settings change, so the change itself notifies nothing', async () => {
    await snapshot(friday, [toPartDieu, toPerrache])
    // Perrache now ranks first: its train becomes the best candidate.
    await rankOutbound(traveller, [parisLyonToPerrache, parisLyonToPartDieu])
    await resetLegReferences(traveller.client, traveller.id, new Date('2026-10-16T08:00:00Z'))

    const { sent } = await snapshot(saturday, [toPartDieu, toPerrache])

    expect(sent).toEqual([])
  })

  describe('« Nouveautés » on the home screen', () => {
    it('lists the latest snapshot’s improvements', async () => {
      await snapshot(friday, [toPerrache])
      await snapshot(saturday, [toPerrache, toPartDieu])

      const { news } = await loadHomeView(traveller.client, traveller.id, saturday.tick)

      expect(news).toEqual([{
        tripKey: '2026-W43',
        legKind: 'outbound',
        date: '2026-10-23',
        kind: 'new-best',
        train: { date: '2026-10-23', trainNumber: '6603', ...parisLyonToPartDieu, departureTime: '07:00', arrivalTime: '08:56' },
      }])
    })

    it('leaves out the legs muted since, and shows nothing of another traveller', async () => {
      await snapshot(friday, [toPartDieu])
      await setMute(traveller.client, { tripKey: '2026-W43', leg: 'outbound' }, true)

      expect((await loadHomeView(traveller.client, traveller.id, friday.tick)).news).toEqual([])
      expect((await loadHomeView(other.client, other.id, friday.tick)).news.map(item => item.train.trainNumber)).toEqual(['6603'])
    })
  })
})
