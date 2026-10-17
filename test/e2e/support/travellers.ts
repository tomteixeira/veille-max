import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../shared/types/database.types'
import { clearMailbox, readLatestEmail, type ReceivedEmail } from './mailbox'

/** The email of the invited traveller of `supabase/seed.sql`. */
export const INVITED_TRAVELLER_EMAIL = 'voyageur@veille-max.test'

/** Where `auth.setup.ts` saves the signed-in traveller's browser state for the other tests. */
export const INVITED_TRAVELLER_STATE = 'test/e2e/.auth/invited-traveller.json'

/** The 6-digit sign-in code carried by a sign-in email. */
export function signInCodeFrom(email: ReceivedEmail): string {
  const code = /\b\d{6}\b/.exec(email.text)?.[0]
  expect(code, `a 6-digit code in « ${email.text} »`).toBeDefined()
  return code!
}

/** Signs `address` in through the sign-in screen, with the code read from the mail catcher, and expects them on `landing`. */
export async function signInThroughTheApp(page: Page, request: APIRequestContext, address: string, landing = '/'): Promise<void> {
  await clearMailbox(request, address)
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(address)
  await page.getByRole('button', { name: 'Recevoir un code' }).click()
  await page.getByLabel('Code à 6 chiffres').fill(signInCodeFrom(await readLatestEmail(request, address)))
  await expect(page).toHaveURL(landing)
}

/** The server role of the local stack, which bypasses RLS: for arranging and cleaning up. */
function admin() {
  return createClient<Database>(process.env.NUXT_PUBLIC_SUPABASE_URL!, process.env.NUXT_SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Supabase Auth's admin API, with the local stack's secret key. */
function authAdmin() {
  return admin().auth.admin
}

async function findAccount(address: string) {
  const { data, error } = await authAdmin().listUsers({ perPage: 1000 })
  expect(error).toBeNull()
  return data.users.find(user => user.email === address)
}

/** Whether Supabase Auth holds an account for `address`. */
export async function hasAccount(address: string): Promise<boolean> {
  return (await findAccount(address)) !== undefined
}

/**
 * Invites a new traveller, as the README says to: an account with a confirmed
 * email, so they can ask for a sign-in code. For tests that need a traveller of
 * their own; remove them with `removeTraveller`. Returns their id.
 *
 * The traveller has been through onboarding, and lands on the home screen once
 * signed in, unless `onboarded` is `false`.
 */
export async function inviteTraveller(address: string, { onboarded = true } = {}): Promise<string> {
  const { data, error } = await authAdmin().createUser({ email: address, email_confirm: true })
  expect(error).toBeNull()
  const travellerId = data.user!.id
  if (onboarded) {
    const settings = await admin().from('traveller_settings').insert({ user_id: travellerId, onboarding_step: 'done' })
    expect(settings.error).toBeNull()
  }
  return travellerId
}

/** Deletes the traveller's account, and with it every row they own. */
export async function removeTraveller(address: string): Promise<void> {
  const account = await findAccount(address)
  if (!account) return
  const { error } = await authAdmin().deleteUser(account.id)
  expect(error).toBeNull()
}
