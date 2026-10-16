import type { PushMessage } from '#shared/types/push'

export type { PushMessage }

/** Where a push goes: a device's Web Push subscription. */
export interface PushTarget {
  endpoint: string
  /** The subscription's keys, base64url-encoded. */
  keys: { p256dh: string, auth: string }
}

/** What the push service said: it accepted the push, or the subscription no longer exists (404/410). */
export type PushDelivery = 'delivered' | 'gone'

/**
 * Sends pushes (spec, "Notification delivery"): Web Push in production
 * (`webPushGateway`), a recording fake in tests. Throws when the push service
 * cannot take the push for any other reason.
 */
export interface PushGateway {
  send(target: PushTarget, message: PushMessage): Promise<PushDelivery>
}
