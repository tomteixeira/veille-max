import webpush from 'web-push'
import type { PushDelivery, PushGateway, PushMessage, PushTarget } from './push-gateway'

/** The app server's VAPID identity: who sends the pushes, and the key pair that signs them. */
export interface VapidKeys {
  /** A `mailto:` or `https:` contact for the push services. */
  subject: string
  /** Base64url-encoded, as `npx web-push generate-vapid-keys` prints them. */
  publicKey: string
  privateKey: string
}

/** Long enough for a phone that was off overnight to get the morning's notifications. */
const TIME_TO_LIVE_SECONDS = 24 * 60 * 60

/**
 * The push gateway of production: Web Push with VAPID. `sendNotification` is
 * `web-push`'s; tests pass a stand-in for the push service.
 */
export function webPushGateway(vapid: VapidKeys, sendNotification = webpush.sendNotification): PushGateway {
  return {
    async send(target: PushTarget, message: PushMessage): Promise<PushDelivery> {
      try {
        await sendNotification(target, JSON.stringify(message), {
          vapidDetails: vapid,
          TTL: TIME_TO_LIVE_SECONDS,
          // Delivered at once, even to a phone saving its battery.
          urgency: 'high',
        })
        return 'delivered'
      }
      catch (error) {
        if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone'
        throw error
      }
    },
  }
}
