import type { SupabaseClient } from '@supabase/supabase-js'
import { isOnboardingStep, type OnboardingPosition, type OnboardingProgress } from '../domain/onboarding'
import type { Database } from '../types/database.types'

// Reads and writes a traveller's onboarding progress (table `traveller_settings`),
// with the template routes and push devices that tell whether two of its steps
// are done. With a traveller's client, RLS limits every read and write to their
// own rows.

type Client = SupabaseClient<Database>

/** Where `travellerId` stands in the onboarding flow, and which steps they completed. */
export async function loadOnboarding(client: Client, travellerId: string): Promise<OnboardingProgress> {
  const [settings, routes, devices] = await Promise.all([
    client.from('traveller_settings').select('onboarding_step, installed_at').eq('user_id', travellerId).maybeSingle(),
    client.from('template_routes').select('*', { count: 'exact', head: true }).eq('user_id', travellerId),
    client.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', travellerId),
  ])
  if (settings.error) throw settings.error
  if (routes.error) throw routes.error
  if (devices.error) throw devices.error

  const step = settings.data?.onboarding_step
  return {
    current: step === 'done' || isOnboardingStep(step) ? step : 'configuration',
    configured: (routes.count ?? 0) > 0,
    installed: settings.data?.installed_at != null,
    notified: (devices.count ?? 0) > 0,
  }
}

/** Moves `travellerId`, who must be the signed-in traveller, to `position` in the flow. */
export async function saveOnboardingStep(client: Client, travellerId: string, position: OnboardingPosition): Promise<void> {
  const { error } = await client.from('traveller_settings').upsert({ user_id: travellerId, onboarding_step: position })
  if (error) throw error
}

/** Records that the app runs from the home screen of a device of `travellerId`, the signed-in traveller. */
export async function recordInstallation(client: Client, travellerId: string): Promise<void> {
  const { error } = await client.from('traveller_settings').upsert({ user_id: travellerId, installed_at: new Date().toISOString() })
  if (error) throw error
}
