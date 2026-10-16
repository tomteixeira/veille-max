import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { forgetPushDevice, loadPushDevices, registerPushDevice, type NewPushDevice } from '#shared/utils/push-device-store'
import { admin, removeTraveller, signedInTraveller, signedOutClient, type Traveller } from './support/travellers'

/** A subscription as a browser's push service would hand it out: a unique endpoint and its keys. */
function newDevice(deviceLabel: string): NewPushDevice {
  return { endpoint: `https://push.example.test/${randomUUID()}`, p256dh: 'p256dh-key', auth: 'auth-secret', deviceLabel }
}

describe('push devices storage', () => {
  let traveller: Traveller
  let other: Traveller

  beforeAll(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('keeps every device on which a traveller turned notifications on, with its label', async () => {
    const iPhone = newDevice('iPhone')
    const mac = newDevice('Mac')
    await registerPushDevice(traveller.client, iPhone)
    await registerPushDevice(traveller.client, mac)

    const devices = await loadPushDevices(traveller.client, traveller.id)

    expect(devices.map(({ endpoint, deviceLabel }) => ({ endpoint, deviceLabel }))).toEqual([
      { endpoint: iPhone.endpoint, deviceLabel: 'iPhone' },
      { endpoint: mac.endpoint, deviceLabel: 'Mac' },
    ])
  })

  it('keeps a device once when notifications are turned on again on it', async () => {
    const iPad = newDevice('iPad')
    await registerPushDevice(traveller.client, iPad)
    await registerPushDevice(traveller.client, { ...iPad, p256dh: 'renewed-key' })

    const devices = await loadPushDevices(traveller.client, traveller.id)

    expect(devices.filter(device => device.endpoint === iPad.endpoint)).toHaveLength(1)
  })

  it('forgets a device when notifications are turned off on it', async () => {
    const android = newDevice('Android')
    await registerPushDevice(traveller.client, android)

    await forgetPushDevice(traveller.client, android.endpoint)

    const devices = await loadPushDevices(traveller.client, traveller.id)
    expect(devices.map(device => device.endpoint)).not.toContain(android.endpoint)
  })

  it('moves a device to the traveller who turns notifications on there last', async () => {
    const shared = newDevice('Mac')
    await registerPushDevice(traveller.client, shared)

    await registerPushDevice(other.client, shared)

    expect((await loadPushDevices(traveller.client, traveller.id)).map(device => device.endpoint)).not.toContain(shared.endpoint)
    expect((await loadPushDevices(other.client, other.id)).map(device => device.endpoint)).toContain(shared.endpoint)
  })

  it('never shows a traveller another traveller’s devices', async () => {
    await registerPushDevice(traveller.client, newDevice('iPhone'))

    expect(await loadPushDevices(other.client, traveller.id)).toEqual([])
  })

  it('never lets a traveller forget another traveller’s device', async () => {
    const iPhone = newDevice('iPhone')
    await registerPushDevice(traveller.client, iPhone)

    await forgetPushDevice(other.client, iPhone.endpoint)

    expect((await loadPushDevices(traveller.client, traveller.id)).map(device => device.endpoint)).toContain(iPhone.endpoint)
  })

  it('refuses to add a device for another traveller directly', async () => {
    const { error } = await other.client.from('push_subscriptions').insert({
      user_id: traveller.id, endpoint: newDevice('iPhone').endpoint, p256dh: 'key', auth: 'secret', device_label: 'iPhone',
    })

    expect(error).toMatchObject({ code: '42501' })
  })

  it('lets no signed-out visitor register a device', async () => {
    await expect(registerPushDevice(signedOutClient(), newDevice('iPhone'))).rejects.toBeTruthy()
  })

  it('removes a traveller’s devices with their account', async () => {
    const leaving = await signedInTraveller()
    await registerPushDevice(leaving.client, newDevice('iPhone'))

    await removeTraveller(leaving)

    const { data } = await admin.from('push_subscriptions').select().eq('user_id', leaving.id)
    expect(data).toEqual([])
  })
})
