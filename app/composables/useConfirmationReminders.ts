import { loadConfirmationReminders, saveConfirmationReminders } from '#shared/utils/traveller-settings-store'

/**
 * Whether the signed-in traveller gets Confirmation Reminders, loaded before
 * the page shows and written straight to Supabase under RLS (spec, "Settings writes").
 */
export async function useConfirmationReminders() {
  const supabase = useSupabaseClient()
  const travellerId = useSupabaseUser().value?.sub

  const loading = useAsyncData(`confirmation-reminders-${travellerId}`, async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    return loadConfirmationReminders(supabase, travellerId)
  })
  const { data } = loading

  async function save(enabled: boolean): Promise<void> {
    if (!travellerId) throw new Error('No signed-in traveller')
    await saveConfirmationReminders(supabase, travellerId, enabled)
    data.value = enabled
  }

  // Last, so that every composable above runs in the component's setup context.
  await loading

  return { enabled: computed(() => data.value ?? true), save }
}
