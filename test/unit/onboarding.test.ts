import { describe, expect, it } from 'vitest'
import { missingOnboardingSteps, onboardingStepAfter, type OnboardingProgress } from '#shared/domain/onboarding'

const newTraveller: OnboardingProgress = { current: 'configuration', configured: false, installed: false, notified: false }

describe('onboarding', () => {
  it('runs the steps in order: configuration, installation, notifications', () => {
    expect(onboardingStepAfter('configuration')).toBe('installation')
    expect(onboardingStepAfter('installation')).toBe('notifications')
    expect(onboardingStepAfter('notifications')).toBe('done')
  })

  it('names every step, in order, once a traveller skipped them all', () => {
    expect(missingOnboardingSteps({ ...newTraveller, current: 'done' })).toEqual(['configuration', 'installation', 'notifications'])
  })

  it('names no missing step while the traveller is still in the flow', () => {
    expect(missingOnboardingSteps({ ...newTraveller, current: 'installation' })).toEqual([])
  })

  it('names the steps a traveller skipped once they left the flow', () => {
    const skippedInstallation = { current: 'done', configured: true, installed: false, notified: true } as const

    expect(missingOnboardingSteps(skippedInstallation)).toEqual(['installation'])
  })

  it('names no missing step once every step is done', () => {
    expect(missingOnboardingSteps({ current: 'done', configured: true, installed: true, notified: true })).toEqual([])
  })
})
