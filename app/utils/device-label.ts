/** How a device appears in the traveller's device list. */
export type DeviceLabel = 'iPhone' | 'iPad' | 'Mac' | 'Android' | 'PC Windows' | 'Chromebook' | 'Linux' | 'Appareil'

/** The label of the device a browser runs on, from what it says of itself. */
export function deviceLabel({ userAgent, maxTouchPoints }: { userAgent: string, maxTouchPoints: number }): DeviceLabel {
  if (/iPhone|iPod/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Macintosh/.test(userAgent)) return maxTouchPoints > 1 ? 'iPad' : 'Mac'
  if (/Android/.test(userAgent)) return 'Android'
  if (/Windows/.test(userAgent)) return 'PC Windows'
  if (/CrOS/.test(userAgent)) return 'Chromebook'
  if (/Linux/.test(userAgent)) return 'Linux'
  return 'Appareil'
}

const ON_THIS_DEVICE: Record<DeviceLabel, string> = {
  'iPhone': 'cet iPhone',
  'iPad': 'cet iPad',
  'Mac': 'ce Mac',
  'Android': 'cet appareil Android',
  'PC Windows': 'ce PC Windows',
  'Chromebook': 'ce Chromebook',
  'Linux': 'cet ordinateur Linux',
  'Appareil': 'cet appareil',
}

/** « cet iPhone », « ce Mac »: the device in use, named inside a sentence. */
export function onThisDevice(label: string): string {
  return ON_THIS_DEVICE[label as DeviceLabel] ?? 'cet appareil'
}
