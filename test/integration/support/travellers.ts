import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

// The local stack's settings, as the app reads them (`npm run supabase:env`).
if (existsSync('.env')) process.loadEnvFile('.env')

function setting(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set: start the local stack and run \`npm run supabase:env\``)
  return value
}

const url = setting('NUXT_PUBLIC_SUPABASE_URL')
const publishableKey = setting('NUXT_PUBLIC_SUPABASE_KEY')
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/** The server role, which bypasses RLS: only for arranging and cleaning up. */
const admin = createClient<Database>(url, setting('NUXT_SUPABASE_SECRET_KEY'), noSession)

export interface Traveller {
  id: string
  email: string
  /** A Data API client signed in as this traveller, as the app's browser client is. */
  client: SupabaseClient<Database>
}

/** A Data API client with no session, as a signed-out visitor. */
export function signedOutClient(): SupabaseClient<Database> {
  return createClient<Database>(url, publishableKey, noSession)
}

/** Invites a new traveller and signs them in. Remove them with `removeTraveller`. */
export async function signedInTraveller(): Promise<Traveller> {
  const email = `traveller-${randomUUID()}@veille-max.test`
  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (created.error) throw created.error

  // Signs in without sending an email: the code the email would carry, verified by its hash.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw link.error
  const client = createClient<Database>(url, publishableKey, noSession)
  const signedIn = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })
  if (signedIn.error) throw signedIn.error

  return { id: created.data.user.id, email, client }
}

/** Deletes the traveller's account, and with it every row they own. */
export async function removeTraveller(traveller: Traveller): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(traveller.id)
  if (error) throw error
}
