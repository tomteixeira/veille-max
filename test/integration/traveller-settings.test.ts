import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE_WEIGHT } from '#shared/domain/evaluation'
import { loadConfirmationReminders, loadRouteWeight, saveConfirmationReminders, saveRouteWeight } from '#shared/utils/traveller-settings-store'
import { removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

describe('route weight storage', () => {
  let traveller: Traveller
  let other: Traveller

  beforeAll(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('gives a traveller who never set it the default route weight', async () => {
    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(DEFAULT_ROUTE_WEIGHT)
  })

  it('keeps the latest route weight the traveller saved', async () => {
    await saveRouteWeight(traveller.client, traveller.id, 10)
    await saveRouteWeight(traveller.client, traveller.id, 45)

    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(45)
  })

  it('never shows a traveller another traveller’s route weight', async () => {
    await saveRouteWeight(traveller.client, traveller.id, 60)

    expect(await loadRouteWeight(other.client, traveller.id)).toBe(DEFAULT_ROUTE_WEIGHT)
  })

  it('refuses to save a route weight for another traveller', async () => {
    await expect(saveRouteWeight(other.client, traveller.id, 0)).rejects.toMatchObject({ code: '42501' })

    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(60)
  })
})

describe('confirmation reminders setting storage', () => {
  let traveller: Traveller
  let other: Traveller

  beforeAll(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('turns reminders on for a traveller who never changed the setting', async () => {
    expect(await loadConfirmationReminders(traveller.client, traveller.id)).toBe(true)
  })

  it('keeps reminders off once turned off, before any route weight is chosen, and keeps the route weight apart', async () => {
    await saveConfirmationReminders(traveller.client, traveller.id, false)
    expect(await loadConfirmationReminders(traveller.client, traveller.id)).toBe(false)
    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(DEFAULT_ROUTE_WEIGHT)

    await saveRouteWeight(traveller.client, traveller.id, 45)
    expect(await loadConfirmationReminders(traveller.client, traveller.id)).toBe(false)

    await saveConfirmationReminders(traveller.client, traveller.id, true)
    expect(await loadConfirmationReminders(traveller.client, traveller.id)).toBe(true)
    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(45)
  })

  it('refuses to change another traveller’s setting', async () => {
    await expect(saveConfirmationReminders(other.client, traveller.id, false)).rejects.toMatchObject({ code: '42501' })

    expect(await loadConfirmationReminders(traveller.client, traveller.id)).toBe(true)
  })
})
