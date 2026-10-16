import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadPushDevices, registerPushDevice } from '#shared/utils/push-device-store'
import { sendTestNotification } from '../../server/push/test-notification'
import { recordingPushGateway } from './support/push-gateway'
import { admin, removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

/** Turns notifications on for `traveller` on a new device, and returns its subscription endpoint. */
async function turnOnDevice(traveller: Traveller, deviceLabel: string): Promise<string> {
  const endpoint = `https://push.example.test/${randomUUID()}`
  await registerPushDevice(traveller.client, { endpoint, p256dh: 'p256dh-key', auth: 'auth-secret', deviceLabel })
  return endpoint
}

describe('test notification', () => {
  let traveller: Traveller
  let other: Traveller

  beforeEach(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
  })

  afterEach(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('reaches every device of the traveller, and only theirs', async () => {
    const iPhone = await turnOnDevice(traveller, 'iPhone')
    const mac = await turnOnDevice(traveller, 'Mac')
    await turnOnDevice(other, 'iPhone')
    const gateway = recordingPushGateway()

    const result = await sendTestNotification({ db: admin, gateway, travellerId: traveller.id })

    expect(gateway.sent.map(push => push.endpoint).sort()).toEqual([iPhone, mac].sort())
    expect(result).toEqual({ delivered: 2, gone: 0, failed: 0 })
  })

  it('opens the notification settings when tapped', async () => {
    await turnOnDevice(traveller, 'iPhone')
    const gateway = recordingPushGateway()

    await sendTestNotification({ db: admin, gateway, travellerId: traveller.id })

    expect(gateway.sent[0]?.message).toMatchObject({ title: expect.any(String), body: expect.any(String), url: '/settings' })
  })

  it('deletes a subscription the push service reports gone, and keeps the others', async () => {
    const iPhone = await turnOnDevice(traveller, 'iPhone')
    const oldMac = await turnOnDevice(traveller, 'Mac')
    const gateway = recordingPushGateway({ gone: [oldMac] })

    const result = await sendTestNotification({ db: admin, gateway, travellerId: traveller.id })

    expect(result).toEqual({ delivered: 1, gone: 1, failed: 0 })
    expect((await loadPushDevices(traveller.client, traveller.id)).map(device => device.endpoint)).toEqual([iPhone])
  })

  it('deletes a gone subscription with the traveller’s own client too, as Réglages sends the test', async () => {
    const iPhone = await turnOnDevice(traveller, 'iPhone')
    const oldMac = await turnOnDevice(traveller, 'Mac')
    await turnOnDevice(other, 'iPhone')
    const gateway = recordingPushGateway({ gone: [oldMac] })

    const result = await sendTestNotification({ db: traveller.client, gateway, travellerId: traveller.id })

    expect(gateway.sent.map(push => push.endpoint).sort()).toEqual([iPhone, oldMac].sort())
    expect(result).toEqual({ delivered: 1, gone: 1, failed: 0 })
    expect((await loadPushDevices(traveller.client, traveller.id)).map(device => device.endpoint)).toEqual([iPhone])
  })

  it('still reaches the other devices when one cannot be reached, and keeps it', async () => {
    const iPhone = await turnOnDevice(traveller, 'iPhone')
    const mac = await turnOnDevice(traveller, 'Mac')
    const gateway = recordingPushGateway({ failing: [iPhone] })

    const result = await sendTestNotification({ db: admin, gateway, travellerId: traveller.id })

    expect(result).toEqual({ delivered: 1, gone: 0, failed: 1 })
    expect((await loadPushDevices(traveller.client, traveller.id)).map(device => device.endpoint)).toEqual([iPhone, mac])
  })

  it('sends nothing to a traveller without devices', async () => {
    await turnOnDevice(other, 'iPhone')
    const gateway = recordingPushGateway()

    const result = await sendTestNotification({ db: admin, gateway, travellerId: traveller.id })

    expect(gateway.sent).toEqual([])
    expect(result).toEqual({ delivered: 0, gone: 0, failed: 0 })
  })
})
