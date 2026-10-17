import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Booking, BookedTrain } from '#shared/domain/evaluation'
import { cancelBooking, saveBooking } from '#shared/utils/booking-store'
import { registerPushDevice } from '#shared/utils/push-device-store'
import { saveConfirmationReminders } from '#shared/utils/traveller-settings-store'
import { setMute } from '#shared/utils/trip-store'
import { runTick } from '../../server/tick/run-tick'
import { recordingPushGateway } from './support/push-gateway'
import { fixtureSnapshotSource } from './support/snapshots'
import { admin, removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

// Friday 23 October 2026: its booked legs are reminded on Thursday 22, from noon Paris (10:00 UTC).
const fridayTrain: BookedTrain = { date: '2026-10-23', trainNumber: '6603', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '07:00', arrivalTime: '08:56' }
const outbound: Booking = { tripKey: '2026-W43', legKind: 'outbound', train: fridayTrain }

const thursday = (time: string) => new Date(`2026-10-22T${time}:00Z`)
const at1159 = thursday('09:59')
const at1205 = thursday('10:05')
const at1220 = thursday('10:20')

/** Turns notifications on for `traveller` on a new device, and returns its subscription endpoint. */
async function turnOnDevice(traveller: Traveller, deviceLabel: string): Promise<string> {
  const endpoint = `https://push.example.test/${randomUUID()}`
  await registerPushDevice(traveller.client, { endpoint, p256dh: 'p256dh-key', auth: 'auth-secret', deviceLabel })
  return endpoint
}

describe('confirmation reminders through the tick', () => {
  let snapshotIds: number[]
  // A snapshot SNCF keeps publishing: the ticks below ingest it once, and then only send reminders.
  const fixture = fixtureSnapshotSource({ processedAt: new Date(Date.UTC(2001, 0, 1, 0, 0, Math.floor(Math.random() * 1e9))), trains: [] })
  let traveller: Traveller
  let iPhone: string

  /** Runs the tick at `now`, and returns the pushes it sent to the traveller's devices. */
  async function tickAt(now: Date, gateway = recordingPushGateway()) {
    const summary = await runTick({ db: admin, source: fixture.source, gateway, now })
    const devices = new Set([iPhone])
    return { summary, sent: gateway.sent.filter(push => devices.has(push.endpoint)) }
  }

  beforeAll(async () => {
    // A snapshot of its own, listing the booked train.
    const processedAt = new Date(Date.UTC(2000, 0, 1, 0, 0, Math.floor(Math.random() * 1e9))).toISOString()
    const { data, error } = await admin.rpc('record_snapshot', {
      processed_at: processedAt,
      ingested_at: processedAt,
      trains: [{ date: fridayTrain.date, train_number: fridayTrain.trainNumber, origin_code: fridayTrain.originCode, destination_code: fridayTrain.destinationCode, departure_time: fridayTrain.departureTime, arrival_time: fridayTrain.arrivalTime, open: true }],
    })
    if (error) throw error
    snapshotIds = [(data as { snapshot_id: number }).snapshot_id]
  })

  afterAll(async () => {
    const { data } = await admin.from('snapshots').select('id').eq('processed_at', (await fixture.source.processedAt()).toISOString())
    await admin.from('snapshots').delete().in('id', [...snapshotIds, ...(data ?? []).map(snapshot => snapshot.id)])
  })

  beforeEach(async () => {
    traveller = await signedInTraveller()
    iPhone = await turnOnDevice(traveller, 'iPhone')
    await saveBooking(traveller.client, traveller.id, outbound)
  })

  afterEach(async () => {
    await removeTraveller(traveller)
  })

  it('sends nothing before noon, one reminder from noon, and nothing more on later ticks', async () => {
    expect((await tickAt(at1159)).sent).toEqual([])

    const { sent, summary } = await tickAt(at1205)
    expect(sent).toHaveLength(1)
    expect(summary.reminders).toBeGreaterThanOrEqual(1)

    expect((await tickAt(at1220)).sent).toEqual([])
    expect((await tickAt(thursday('13:30'))).sent).toEqual([])
  })

  it('reminds of the booked leg and SNCF’s 17:00 deadline, and opens « Trajets à confirmer »', async () => {
    const [push] = (await tickAt(at1205)).sent

    expect(push?.message.url).toBe('/confirmations')
    expect(push?.message.title).toContain('confirmer')
    expect(push?.message.body).toContain('17:00')
    expect(push?.message.body).toContain('07:00')
    expect(push?.message.body).toContain('Paris Gare de Lyon')
  })

  it('reaches every device of the traveller', async () => {
    const mac = await turnOnDevice(traveller, 'Mac')
    const gateway = recordingPushGateway()

    await runTick({ db: admin, source: fixture.source, gateway, now: at1205 })

    expect(gateway.sent.map(push => push.endpoint).filter(endpoint => [iPhone, mac].includes(endpoint)).sort()).toEqual([iPhone, mac].sort())
  })

  it('reminds of a muted trip’s booking too', async () => {
    await setMute(traveller.client, { tripKey: '2026-W43' }, true)

    expect((await tickAt(at1205)).sent).toHaveLength(1)
  })

  it('sends nothing when the traveller turned reminders off', async () => {
    await saveConfirmationReminders(traveller.client, traveller.id, false)

    expect((await tickAt(at1205)).sent).toEqual([])
  })

  it('sends nothing for a booking cancelled before noon', async () => {
    await cancelBooking(traveller.client, traveller.id, outbound.tripKey, outbound.legKind)

    expect((await tickAt(at1205)).sent).toEqual([])
  })

  it('tries again at the next tick when no device could be reached', async () => {
    expect((await tickAt(at1205, recordingPushGateway({ failing: [iPhone] }))).sent).toHaveLength(1)

    expect((await tickAt(at1220)).sent).toHaveLength(1)
    expect((await tickAt(thursday('10:35'))).sent).toEqual([])
  })

  it('logs each reminder sent, which only its traveller can read', async () => {
    const other = await signedInTraveller()
    try {
      await tickAt(at1205)

      const own = await traveller.client.from('notification_log').select('kind, trip_key, leg_kind, reminder_date')
      expect(own.data).toEqual([{ kind: 'confirmation_reminder', trip_key: '2026-W43', leg_kind: 'outbound', reminder_date: '2026-10-23' }])
      const others = await other.client.from('notification_log').select('id').eq('user_id', traveller.id)
      expect(others.data).toEqual([])
    }
    finally {
      await removeTraveller(other)
    }
  })
})
