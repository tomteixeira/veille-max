import type { Page } from '@playwright/test'

export interface FakePush {
  /** Whether the browser offers Web Push: Safari on an iPhone does not, outside the home screen. */
  supported: boolean
  /** `Notification.permission` when the page opens. */
  permission: NotificationPermission
  /** What the traveller answers when the app asks for permission. */
  answer?: 'granted' | 'denied'
}

/**
 * Replaces the browser's push service, which tests cannot reach, before the
 * page loads: the permission prompt answers `answer`, and subscribing hands out
 * a subscription of its own. The subscription lasts across reloads of the tab.
 */
export async function fakePush(page: Page, fake: FakePush): Promise<void> {
  await page.addInitScript(({ supported, permission, answer }) => {
    if (!supported) {
      // @ts-expect-error Safari outside the home screen has no PushManager.
      delete window.PushManager
      return
    }
    let currentPermission = permission
    Object.defineProperty(Notification, 'permission', { get: () => currentPermission })

    const stored = sessionStorage.getItem('fake-push-endpoint')
    const subscriptionFor = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' } }),
      unsubscribe: async () => {
        sessionStorage.removeItem('fake-push-endpoint')
        subscription = null
        return true
      },
    })
    let subscription = stored ? subscriptionFor(stored) : null

    const pushManager = {
      getSubscription: async () => subscription,
      subscribe: async () => {
        if (currentPermission === 'default') currentPermission = answer ?? 'default'
        if (currentPermission !== 'granted') throw new DOMException('Permission denied', 'NotAllowedError')
        const endpoint = `https://push.example.test/${crypto.randomUUID()}`
        sessionStorage.setItem('fake-push-endpoint', endpoint)
        subscription = subscriptionFor(endpoint)
        return subscription
      },
    }
    Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve({ pushManager }) })
  }, fake)
}

/**
 * Makes the page run as if launched from the home screen (the manifest's
 * standalone display mode), from its next load on.
 */
export async function fakeHomeScreen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      const list = matchMedia(query)
      return query === '(display-mode: standalone)' ? Object.defineProperty(list, 'matches', { value: true }) : list
    }
  })
}
