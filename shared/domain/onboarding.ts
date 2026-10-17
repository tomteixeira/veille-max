/**
 * Onboarding (spec, user stories 5–7): the three steps a new traveller goes
 * through after their first sign-in, any of which they may skip.
 */

/** The steps of the flow, in the order the traveller meets them. */
export const ONBOARDING_STEPS = ['configuration', 'installation', 'notifications'] as const

/**
 * - `configuration`: rank a first route in the trip template;
 * - `installation`: add the app to the home screen, which iOS requires before it sends notifications;
 * - `notifications`: turn notifications on, on a device.
 */
export type OnboardingStep = typeof ONBOARDING_STEPS[number]

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly unknown[]).includes(value)
}

/** The step the flow shows a traveller; `done` once they finished or skipped the last step. */
export type OnboardingPosition = OnboardingStep | 'done'

/** Where a traveller stands in the flow, and which steps they completed. */
export interface OnboardingProgress {
  current: OnboardingPosition
  /** Their trip template ranks at least one route. */
  configured: boolean
  /** The app once ran from the home screen of one of their devices. */
  installed: boolean
  /** At least one of their devices receives notifications. */
  notified: boolean
}

/** The step the flow moves to after `step`, whether it was completed or skipped. */
export function onboardingStepAfter(step: OnboardingStep): OnboardingPosition {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? 'done'
}

/** Whether the traveller completed `step`. */
export function isOnboardingStepDone(progress: OnboardingProgress, step: OnboardingStep): boolean {
  switch (step) {
    case 'configuration':
      return progress.configured
    case 'installation':
      return progress.installed
    case 'notifications':
      return progress.notified
  }
}

/**
 * The steps to remind the traveller of, in flow order: those not completed
 * once they left the flow. None while they are still in it.
 */
export function missingOnboardingSteps(progress: OnboardingProgress): OnboardingStep[] {
  if (progress.current !== 'done') return []
  return ONBOARDING_STEPS.filter(step => !isOnboardingStepDone(progress, step))
}
