import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { NotificationResult, PushMessage } from '#shared/types/push'
import type { PushGateway } from './push-gateway'

/**
 * Sends `message` to every device of `travellerId`, and deletes the devices
 * whose subscription the push service reports gone. A device that cannot be
 * reached is kept, and does not stop the others.
 */
export async function notifyTraveller(
  db: SupabaseClient<Database>,
  gateway: PushGateway,
  travellerId: string,
  message: PushMessage,
): Promise<NotificationResult> {
  const { data: devices, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', travellerId)
  if (error) throw error

  const deliveries = await Promise.allSettled(devices.map(device =>
    gateway.send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, message),
  ))

  const goneIds = devices.filter((_, index) => {
    const delivery = deliveries[index]
    return delivery?.status === 'fulfilled' && delivery.value === 'gone'
  }).map(device => device.id)
  if (goneIds.length > 0) {
    const { error: deleteError } = await db.from('push_subscriptions').delete().in('id', goneIds)
    if (deleteError) throw deleteError
  }

  for (const delivery of deliveries) {
    if (delivery.status === 'rejected') console.error('Push failed', delivery.reason)
  }

  return {
    delivered: deliveries.filter(delivery => delivery.status === 'fulfilled' && delivery.value === 'delivered').length,
    gone: goneIds.length,
    failed: deliveries.filter(delivery => delivery.status === 'rejected').length,
  }
}
