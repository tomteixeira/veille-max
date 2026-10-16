import { expect, test, type Page } from '@playwright/test'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

interface FakePush {
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
async function fakePush(page: Page, fake: FakePush): Promise<void> {
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

test('the app can be installed: its manifest and service worker are served', async ({ page, request }) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.status()).toBe(200)
  expect(manifest.headers()['content-type']).toContain('application/manifest+json')
  expect(await manifest.json()).toMatchObject({
    name: 'Veille MAX',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]),
  })
  for (const icon of ['/pwa-192x192.png', '/pwa-512x512.png', '/maskable-icon-512x512.png', '/apple-touch-icon-180x180.png']) {
    expect((await request.get(icon)).status(), icon).toBe(200)
  }

  const serviceWorker = await request.get('/sw.js')
  expect(serviceWorker.status()).toBe(200)
  expect(serviceWorker.headers()['content-type']).toContain('javascript')

  await page.goto('/settings')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon-180x180.png')
})

test.describe('notification settings', () => {
  // A traveller of their own, since it adds and removes devices: they start signed out.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a traveller turns notifications on and off on their iPhone, and sends a test', async ({ page, request }) => {
    const email = `notifications-${Date.now()}@veille-max.test`
    await inviteTraveller(email)

    try {
      await signInThroughTheApp(page, request, email)
      const context = page.context()

      /** Opens Réglages in a new tab whose browser behaves as `fake` says, and returns its Notifications card. */
      async function openSettings(fake: FakePush) {
        const tab = await context.newPage()
        await fakePush(tab, fake)
        await tab.goto('/settings')
        const card = tab.getByRole('region', { name: 'Notifications' })
        return { tab, card, toggle: card.getByRole('switch', { name: 'Notifications sur cet iPhone' }) }
      }

      await test.step('in Safari, outside the home screen, the app asks to be installed first', async () => {
        const { tab, card, toggle } = await openSettings({ supported: false, permission: 'default' })
        await expect(card).toContainText('Ajoutez d’abord Veille MAX à l’écran d’accueil')
        await expect(toggle).toBeDisabled()
        await expect(card).toContainText('Aucun appareil ne reçoit les notifications pour l’instant.')
        await expect(card.getByRole('button', { name: 'Envoyer une notification de test' })).toBeDisabled()
        await tab.close()
      })

      await test.step('when the traveller refuses at the prompt, notifications stay off', async () => {
        const { tab, card, toggle } = await openSettings({ supported: true, permission: 'default', answer: 'denied' })
        await expect(toggle).toBeEnabled()
        await expect(toggle).not.toBeChecked()
        await toggle.click()
        await expect(card).toContainText('Notifications refusées. Autorisez-les pour Veille MAX dans les réglages de cet iPhone.')
        await expect(toggle).toBeDisabled()
        await expect(toggle).not.toBeChecked()
        await tab.close()
      })

      await test.step('once refused, the app explains where to allow them', async () => {
        const { tab, card, toggle } = await openSettings({ supported: true, permission: 'denied' })
        await expect(card).toContainText('Notifications refusées.')
        await expect(toggle).toBeDisabled()
        await tab.close()
      })

      const { tab, card, toggle } = await openSettings({ supported: true, permission: 'default', answer: 'granted' })

      await test.step('when the traveller allows them, this iPhone joins their devices', async () => {
        await expect(card).toContainText('Nouveaux trains, chaque matin.')
        await toggle.click()
        await expect(toggle).toBeChecked()
        const devices = card.getByRole('list', { name: 'Appareils' }).getByRole('listitem')
        await expect(devices).toHaveCount(1)
        await expect(devices).toContainText('iPhone')
        await expect(devices).toContainText('Cet appareil')
      })

      await test.step('the test notification reports the devices it reached', async () => {
        // The real push service is out of reach: the server's answer stands in for it.
        await tab.route('/api/push/test', route => route.fulfill({ json: { delivered: 1, gone: 0, failed: 0 } }))
        await card.getByRole('button', { name: 'Envoyer une notification de test' }).click()
        await expect(card.getByRole('status')).toHaveText('Notification envoyée à 1 appareil.')
      })

      await test.step('when no device can be reached, the test says so', async () => {
        await tab.route('/api/push/test', route => route.fulfill({ status: 502, json: { delivered: 0, gone: 0, failed: 1 } }))
        await card.getByRole('button', { name: 'Envoyer une notification de test' }).click()
        await expect(card.getByRole('alert')).toHaveText('Aucun appareil n’a pu être joint. Réessayez dans un moment.')
      })

      await test.step('after reloading, notifications are still on', async () => {
        await tab.reload()
        await expect(toggle).toBeChecked()
        await expect(card.getByRole('listitem')).toContainText('Cet appareil')
      })

      await test.step('turning them off removes this iPhone from the devices', async () => {
        await toggle.click()
        await expect(toggle).not.toBeChecked()
        await expect(card).toContainText('Aucun appareil ne reçoit les notifications pour l’instant.')
        await expect(card.getByRole('button', { name: 'Envoyer une notification de test' })).toBeDisabled()
      })
    }
    finally {
      await removeTraveller(email)
    }
  })
})
