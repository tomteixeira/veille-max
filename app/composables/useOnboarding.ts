import { missingOnboardingSteps, type OnboardingPosition } from '#shared/domain/onboarding'
import { loadOnboarding, recordInstallation, saveOnboardingStep } from '#shared/utils/onboarding-store'

/**
 * The signed-in traveller's onboarding progress, loaded before the page shows
 * and written straight to Supabase under RLS (spec, "Settings writes"). Once
 * mounted, records the installation when the app runs from the home screen.
 */
export async function useOnboarding() {
  const supabase = useSupabaseClient()
  const travellerId = useSupabaseUser().value?.sub

  const loading = useAsyncData(`onboarding-${travellerId}`, async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    return loadOnboarding(supabase, travellerId)
  })
  const { data, refresh } = loading

  onMounted(async () => {
    if (!travellerId || !data.value || data.value.installed || !runsFromHomeScreen()) return
    try {
      await recordInstallation(supabase, travellerId)
      data.value = { ...data.value, installed: true }
    }
    catch (error) {
      // Recorded on the next launch from the home screen.
      console.error('The installation could not be recorded', error)
    }
  })

  /** Moves the traveller to `position` in the flow. */
  async function moveTo(position: OnboardingPosition): Promise<void> {
    if (!travellerId) throw new Error('No signed-in traveller')
    await saveOnboardingStep(supabase, travellerId, position)
    // The data is a shallow ref: replace it for the page to see the change.
    if (data.value) data.value = { ...data.value, current: position }
  }

  // Last, so that every composable above runs in the component's setup context.
  await loading

  return {
    progress: computed(() => data.value ?? null),
    /** The steps to remind the traveller of, in flow order. */
    missing: computed(() => data.value ? missingOnboardingSteps(data.value) : []),
    refresh,
    moveTo,
  }
}
