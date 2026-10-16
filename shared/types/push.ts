/**
 * The payload of every push: what the notification shows, and where tapping
 * it leads. The server sends it (`server/push/push-gateway.ts`), the service
 * worker reads it (`service-worker/push-payload.ts`).
 */
export interface PushMessage {
  title: string
  body: string
  /** A path inside the app's scope, e.g. `/trips/2026-W44/outbound`. */
  url: string
}

/** How many of a traveller's devices took a notification, were gone (and deleted), or could not be reached. */
export interface NotificationResult {
  delivered: number
  gone: number
  failed: number
}
