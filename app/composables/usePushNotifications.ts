import type { NotificationResult } from '#shared/types/push'
import { forgetPushDevice, loadPushDevices, registerPushDevice } from '#shared/utils/push-device-store'

/**
 * Where notifications stand on the device in use:
 * - `pending`: not known before the page hydrates and the service worker is ready;
 * - `install`: an iPhone or iPad outside the home screen, where Safari offers no push;
 * - `unsupported`: a browser without Web Push;
 * - `unavailable`: the server has no VAPID key to send with;
 * - `denied`: the traveller refused notifications to the app;
 * - `off` and `on`: whether this device is among the traveller's devices.
 */
export type ThisDeviceState = 'pending' | 'install' | 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on'

/** The VAPID public key as `PushManager.subscribe` takes it: bytes, from the base64url of `web-push`. */
function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0))
}

/** An iPhone or iPad running the app in Safari rather than from the home screen. */
function inSafariOnIos(label: DeviceLabel): boolean {
  return (label === 'iPhone' || label === 'iPad') && !runsFromHomeScreen()
}

/**
 * The signed-in traveller's push devices, and notifications on the device in
 * use: turning them on and off, and sending a test notification. Devices are
 * read and written straight in Supabase under RLS (spec, "Settings writes").
 */
export async function usePushNotifications() {
  const supabase = useSupabaseClient()
  const travellerId = useSupabaseUser().value?.sub
  const { vapidPublicKey } = useRuntimeConfig().public

  const loading = useAsyncData(`push-devices-${travellerId}`, async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    return loadPushDevices(supabase, travellerId)
  })
  const { data, refresh } = loading
  const devices = computed(() => data.value ?? [])

  const support = ref<'pending' | 'install' | 'unsupported' | 'ready'>('pending')
  const permission = ref<NotificationPermission>('default')
  const registration = shallowRef<ServiceWorkerRegistration>()
  /** The push subscription of the browser in use, whoever it belongs to. */
  const endpoint = ref<string | null>(null)
  /** The label this device gets in the device list. */
  const label = ref<DeviceLabel>('Appareil')

  onMounted(async () => {
    label.value = deviceLabel(navigator)
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      support.value = inSafariOnIos(label.value) ? 'install' : 'unsupported'
      return
    }
    permission.value = Notification.permission
    registration.value = await navigator.serviceWorker.ready
    endpoint.value = (await registration.value.pushManager.getSubscription())?.endpoint ?? null
    support.value = 'ready'
  })

  const state = computed<ThisDeviceState>(() => {
    if (support.value !== 'ready') return support.value
    if (!vapidPublicKey) return 'unavailable'
    if (permission.value === 'denied') return 'denied'
    return devices.value.some(device => device.endpoint === endpoint.value) ? 'on' : 'off'
  })

  /**
   * Asks for permission and subscribes: call it straight from the tap, since
   * iOS only shows the prompt inside a user gesture. Resolves without
   * subscribing when the traveller refuses.
   */
  async function turnOn(): Promise<void> {
    const pushManager = registration.value?.pushManager
    if (!pushManager) throw new Error('No service worker')
    const options = { userVisibleOnly: true, applicationServerKey: applicationServerKey(vapidPublicKey) }
    let subscription: PushSubscription
    try {
      subscription = await pushManager.subscribe(options)
    }
    catch (error) {
      permission.value = Notification.permission
      if (permission.value !== 'granted') return
      // A subscription made with a former VAPID key: replace it. Permission is granted, so no gesture is needed.
      if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error
      await (await pushManager.getSubscription())?.unsubscribe()
      subscription = await pushManager.subscribe(options)
    }
    permission.value = Notification.permission

    const { keys } = subscription.toJSON()
    if (!keys?.p256dh || !keys.auth) throw new Error('Push subscription without keys')
    await registerPushDevice(supabase, { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth, deviceLabel: label.value })
    endpoint.value = subscription.endpoint
    await refresh()
  }

  /** Unsubscribes this device and removes it from the traveller's devices. */
  async function turnOff(): Promise<void> {
    const subscription = await registration.value?.pushManager.getSubscription()
    if (subscription) {
      await forgetPushDevice(supabase, subscription.endpoint)
      await subscription.unsubscribe()
    }
    endpoint.value = null
    await refresh()
  }

  /** Sends a test notification to every device; the device list then drops the devices found gone. */
  async function sendTest(): Promise<NotificationResult> {
    try {
      return await $fetch<NotificationResult>('/api/push/test', { method: 'POST' })
    }
    finally {
      await refresh()
    }
  }

  // Last, so that every composable above runs in the component's setup context.
  await loading

  return {
    devices,
    state,
    /** Whether a device of the list is the one in use. */
    isThisDevice: (deviceEndpoint: string) => deviceEndpoint === endpoint.value,
    thisDevice: computed(() => onThisDevice(label.value)),
    turnOn,
    turnOff,
    sendTest,
  }
}
