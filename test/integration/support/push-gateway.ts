import type { PushMessage } from '#shared/types/push'
import type { PushDelivery, PushGateway, PushTarget } from '../../../server/push/push-gateway'

/** One push the recording gateway was asked to send. */
export interface SentPush {
  endpoint: string
  message: PushMessage
}

/**
 * A push gateway that sends nothing and records every push (spec, seam 2). The
 * push service reports the subscriptions of `gone` gone, and fails to reach
 * those of `failing`.
 */
export function recordingPushGateway({ gone = [], failing = [] }: { gone?: string[], failing?: string[] } = {}): PushGateway & { sent: SentPush[] } {
  const sent: SentPush[] = []
  return {
    sent,
    async send(target: PushTarget, message: PushMessage): Promise<PushDelivery> {
      sent.push({ endpoint: target.endpoint, message })
      if (failing.includes(target.endpoint)) throw new Error(`Push service unreachable for ${target.endpoint}`)
      return gone.includes(target.endpoint) ? 'gone' : 'delivered'
    },
  }
}
