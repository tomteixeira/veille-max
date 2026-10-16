/// <reference lib="webworker" />
import { notificationTarget, readPushMessage } from './push-payload'

// The app's service worker (`@vite-pwa/nuxt`, `injectManifest` strategy). It
// shows notifications and opens the app when one is tapped. It handles no
// `fetch`: every page load reaches the server, which keeps refreshing the
// long-lived session cookies (ticket 02) and serves the latest snapshot.

declare const self: ServiceWorkerGlobalScope

// A new version takes over at once: it holds no cache that could go stale.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Every push shows a visible notification: iOS revokes the subscription of an app that stays silent.
self.addEventListener('push', (event) => {
  const message = readPushMessage(event.data?.text() ?? null)
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/pwa-192x192.png',
    data: { url: message.url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(open(notificationTarget(event.notification.data?.url, self.registration.scope)))
})

/** Brings the app forward on `url`: in its open window if there is one, in a new one otherwise. */
async function open(url: string): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const app = windows.find(client => client.url.startsWith(self.registration.scope))
  if (app) {
    const focused = await app.focus()
    if (await focused.navigate(url).catch(() => null)) return
  }
  await self.clients.openWindow(url)
}
