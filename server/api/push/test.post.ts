import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import type { NotificationResult } from '../../push/notify-traveller'
import { sendTestNotification } from '../../push/test-notification'
import { webPushGateway } from '../../push/web-push-gateway'

/**
 * « Envoyer une notification de test »: sends a notification to every device
 * of the signed-in traveller. Answers 502 when none of them could be reached.
 */
export default defineEventHandler(async (event): Promise<NotificationResult> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { vapidSubject, vapidPrivateKey, public: { vapidPublicKey } } = useRuntimeConfig(event)
  if (!vapidSubject || !vapidPrivateKey || !vapidPublicKey) {
    console.error('Push: NUXT_VAPID_SUBJECT, NUXT_VAPID_PRIVATE_KEY or NUXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
    throw createError({ statusCode: 503, statusMessage: 'Notifications are not configured' })
  }

  const result = await sendTestNotification({
    // The traveller's own client: RLS keeps the reads and deletions to their devices.
    db: await serverSupabaseClient<Database>(event),
    gateway: webPushGateway({ subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey }),
    travellerId: traveller.sub,
  })
  if (result.failed > 0 && result.delivered === 0) {
    throw createError({ statusCode: 502, statusMessage: 'No device could be reached', data: result })
  }
  return result
})
