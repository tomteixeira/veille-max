import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { webPushGateway } from '../../push/web-push-gateway'
import { openDataSnapshotSource } from '../../snapshots/open-data-snapshot-source'
import { runTick, type TickSummary } from '../../tick/run-tick'
import { isTickAuthorized, TICK_SECRET_HEADER } from '../../tick/tick-secret'

/**
 * The tick (ADR 0003): `pg_cron` posts here every 15 minutes with the shared
 * secret, and the server does whatever is due. Returns what it did.
 */
export default defineEventHandler(async (event): Promise<TickSummary> => {
  const { tickSecret, vapidSubject, vapidPrivateKey, public: { vapidPublicKey } } = useRuntimeConfig(event)
  if (!tickSecret) console.error('Tick: NUXT_TICK_SECRET is not set, every call is refused')
  if (!isTickAuthorized(getHeader(event, TICK_SECRET_HEADER), tickSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pushConfigured = vapidSubject && vapidPrivateKey && vapidPublicKey
  if (!pushConfigured) console.error('Tick: NUXT_VAPID_SUBJECT, NUXT_VAPID_PRIVATE_KEY or NUXT_PUBLIC_VAPID_PUBLIC_KEY is not set, no notification is sent')

  const summary = await runTick({
    db: serverSupabaseServiceRole<Database>(event),
    source: openDataSnapshotSource(),
    gateway: pushConfigured ? webPushGateway({ subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey }) : null,
    now: new Date(),
  })
  console.info('Tick', JSON.stringify(summary))
  return summary
})
