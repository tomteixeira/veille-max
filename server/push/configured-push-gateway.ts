import type { H3Event } from 'h3'
import type { PushGateway } from './push-gateway'
import { webPushGateway } from './web-push-gateway'

/** The Web Push gateway with the app's VAPID keys, or `null` (logged) when they are not set. */
export function configuredPushGateway(event: H3Event): PushGateway | null {
  const { vapidSubject, vapidPrivateKey, public: { vapidPublicKey } } = useRuntimeConfig(event)
  if (!vapidSubject || !vapidPrivateKey || !vapidPublicKey) {
    console.error('Push: NUXT_VAPID_SUBJECT, NUXT_VAPID_PRIVATE_KEY or NUXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
    return null
  }
  return webPushGateway({ subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey })
}
