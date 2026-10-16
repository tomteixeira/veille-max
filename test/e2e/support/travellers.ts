import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
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

/** Signs `address` in through the sign-in screen, with the code read from the mail catcher. */
export async function signInThroughTheApp(page: Page, request: APIRequestContext, address: string): Promise<void> {
  await clearMailbox(request, address)
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(address)
  await page.getByRole('button', { name: 'Recevoir un code' }).click()
  await page.getByLabel('Code à 6 chiffres').fill(signInCodeFrom(await readLatestEmail(request, address)))
  await expect(page).toHaveURL('/')
}

/** Whether Supabase Auth holds an account for `address`, asked with the local stack's secret key. */
export async function hasAccount(address: string): Promise<boolean> {
  const admin = createClient(process.env.NUXT_PUBLIC_SUPABASE_URL!, process.env.NUXT_SUPABASE_SECRET_KEY!)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  expect(error).toBeNull()
  return data.users.some(user => user.email === address)
}
