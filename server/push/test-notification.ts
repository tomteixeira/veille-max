import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { notifyTraveller, type NotificationResult } from './notify-traveller'
import type { PushGateway } from './push-gateway'

export interface TestNotificationDependencies {
  db: SupabaseClient<Database>
  gateway: PushGateway
  travellerId: string
}

/**
 * « Envoyer une notification de test » in Réglages: proves the whole chain
 * works on every device of the traveller. Tapping it reopens the settings.
 */
export function sendTestNotification({ db, gateway, travellerId }: TestNotificationDependencies): Promise<NotificationResult> {
  return notifyTraveller(db, gateway, travellerId, {
    title: 'Veille MAX',
    body: 'Notification de test : tout fonctionne sur cet appareil.',
    url: '/settings',
  })
}
