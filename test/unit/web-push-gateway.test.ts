import webpush, { type RequestOptions, type SendResult } from 'web-push'
import { describe, expect, it } from 'vitest'
import { webPushGateway, type VapidKeys } from '../../server/push/web-push-gateway'

const { WebPushError } = webpush

const vapid: VapidKeys = { subject: 'mailto:test@veille-max.test', publicKey: 'public-key', privateKey: 'private-key' }
const target = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } }
const message = { title: 'Veille MAX', body: 'Un meilleur train', url: '/trips/2026-W44/outbound' }

interface Call {
  subscription: { endpoint: string, keys: { p256dh: string, auth: string } }
  payload: unknown
  options: RequestOptions | undefined
}

/** A stand-in for `web-push`'s `sendNotification`, answering with `statusCode`. */
function pushService(statusCode: number) {
  const calls: Call[] = []
  async function sendNotification(subscription: Call['subscription'], payload?: string | Buffer | null, options?: RequestOptions): Promise<SendResult> {
    calls.push({ subscription, payload: JSON.parse(String(payload)), options })
    if (statusCode >= 300) throw new WebPushError('Received unexpected response code', statusCode, {}, '', subscription.endpoint)
    return { statusCode, body: '', headers: {} }
  }
  return { calls, sendNotification }
}

describe('Web Push gateway', () => {
  it('sends the message as a JSON payload, signed with the VAPID keys', async () => {
    const service = pushService(201)

    expect(await webPushGateway(vapid, service.sendNotification).send(target, message)).toBe('delivered')

    expect(service.calls).toEqual([{
      subscription: target,
      payload: message,
      options: expect.objectContaining({ vapidDetails: vapid }),
    }])
  })

  it.each([404, 410])('reports a subscription gone when the push service answers %i', async (statusCode) => {
    expect(await webPushGateway(vapid, pushService(statusCode).sendNotification).send(target, message)).toBe('gone')
  })

  it.each([400, 413, 429, 500])('fails when the push service answers %i', async (statusCode) => {
    await expect(webPushGateway(vapid, pushService(statusCode).sendNotification).send(target, message)).rejects.toBeInstanceOf(WebPushError)
  })
})
