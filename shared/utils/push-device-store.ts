import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

// Reads and writes a traveller's push devices (table `push_subscriptions`).
// With a traveller's client, RLS limits every read and removal to their own
// devices.

type Client = SupabaseClient<Database>

/** A device on which notifications are turned on: its Web Push subscription and the label the traveller sees. */
export interface PushDevice {
  /** The push service URL of the subscription: identifies the device. */
  endpoint: string
  deviceLabel: string
  /** When notifications were turned on there. */
  createdAt: string
}

/** What a browser hands out when it subscribes to push, with the label of its device. */
export interface NewPushDevice {
  endpoint: string
  /** The subscription's keys, base64url-encoded as `PushSubscription.toJSON()` gives them. */
  p256dh: string
  auth: string
  deviceLabel: string
}

/** The devices of `travellerId`, oldest first. */
export async function loadPushDevices(client: Client, travellerId: string): Promise<PushDevice[]> {
  const { data, error } = await client
    .from('push_subscriptions')
    .select('endpoint, device_label, created_at')
    .eq('user_id', travellerId)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data.map(row => ({ endpoint: row.endpoint, deviceLabel: row.device_label, createdAt: row.created_at }))
}

/**
 * Gives the signed-in traveller this device's subscription. Turning
 * notifications on again on a device keeps it once, with its latest keys.
 */
export async function registerPushDevice(client: Client, device: NewPushDevice): Promise<void> {
  const { error } = await client.rpc('register_push_device', {
    endpoint: device.endpoint,
    p256dh: device.p256dh,
    auth: device.auth,
    device_label: device.deviceLabel,
  })
  if (error) throw error
}

/** Forgets the signed-in traveller's device with this subscription, if they have it. */
export async function forgetPushDevice(client: Client, endpoint: string): Promise<void> {
  const { error } = await client.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
