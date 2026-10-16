import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE_WEIGHT } from '#shared/domain/evaluation'
import { defaultTripTemplate } from '#shared/domain/trip-template'
import { loadOnboarding, recordInstallation, saveOnboardingStep } from '#shared/utils/onboarding-store'
import { registerPushDevice } from '#shared/utils/push-device-store'
import { loadRouteWeight, saveRouteWeight } from '#shared/utils/traveller-settings-store'
import { saveTemplateLeg } from '#shared/utils/trip-template-store'
import { removeTraveller, signedInTraveller, type Traveller } from './support/travellers'

describe('onboarding progress storage', () => {
  let traveller: Traveller
  let other: Traveller

  beforeAll(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
  })

  it('starts a new traveller at the first step, with nothing done', async () => {
    expect(await loadOnboarding(traveller.client, traveller.id))
      .toEqual({ current: 'configuration', configured: false, installed: false, notified: false })
  })

  it('keeps the step the traveller reached', async () => {
    await saveOnboardingStep(traveller.client, traveller.id, 'installation')

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ current: 'installation' })
  })

  it('leaves the route weight to its default when saving the step, and the step alone when saving the route weight', async () => {
    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(DEFAULT_ROUTE_WEIGHT)

    await saveRouteWeight(traveller.client, traveller.id, 15)

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ current: 'installation' })
    expect(await loadRouteWeight(traveller.client, traveller.id)).toBe(15)
  })

  it('counts the configuration as done once the template ranks a route', async () => {
    const outbound = { ...defaultTripTemplate().outbound, routes: [{ originCode: 'FRPLY', destinationCode: 'FRLPD' }] }
    await saveTemplateLeg(traveller.client, 'outbound', outbound)

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ configured: true })
  })

  it('counts the installation as done once the app ran from a home screen', async () => {
    await recordInstallation(traveller.client, traveller.id)

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ installed: true })
  })

  it('counts notifications as done once a device receives them', async () => {
    await registerPushDevice(traveller.client, {
      endpoint: `https://push.example.test/${traveller.id}`,
      p256dh: 'p256dh',
      auth: 'auth',
      deviceLabel: 'iPhone',
    })

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ notified: true })
  })

  it('never shows a traveller another traveller’s progress', async () => {
    await saveOnboardingStep(traveller.client, traveller.id, 'done')

    expect(await loadOnboarding(other.client, traveller.id))
      .toEqual({ current: 'configuration', configured: false, installed: false, notified: false })
  })

  it('refuses to save progress for another traveller', async () => {
    await expect(saveOnboardingStep(other.client, traveller.id, 'notifications')).rejects.toMatchObject({ code: '42501' })

    expect(await loadOnboarding(traveller.client, traveller.id)).toMatchObject({ current: 'done' })
  })
})
