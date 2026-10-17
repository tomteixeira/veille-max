import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import type { NotificationResult } from '#shared/types/push'
import { configuredPushGateway } from '../../push/configured-push-gateway'
import { sendTestNotification } from '../../push/test-notification'

/**
 * « Envoyer une notification de test »: sends a notification to every device
 * of the signed-in traveller. Answers 502 when none of them could be reached.
 */
export default defineEventHandler(async (event): Promise<NotificationResult> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const gateway = configuredPushGateway(event)
  if (!gateway) throw createError({ statusCode: 503, statusMessage: 'Notifications are not configured' })

  const result = await sendTestNotification({
    // The traveller's own client: RLS keeps the reads and deletions to their devices.
    db: await serverSupabaseClient<Database>(event),
    gateway,
    travellerId: traveller.sub,
  })
  if (result.failed > 0 && result.delivered === 0) {
    throw createError({ statusCode: 502, statusMessage: 'No device could be reached', data: result })
  }
  return result
})
