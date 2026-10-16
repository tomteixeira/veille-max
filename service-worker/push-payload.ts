import type { PushMessage } from '../shared/types/push'

/** Shown when a push carries no readable message: iOS requires a visible notification for every push. */
const FALLBACK: PushMessage = { title: 'Veille MAX', body: 'Ouvrez l’app pour voir les nouveautés.', url: '/' }

/** The message a push carries (`PushMessage`), or a generic one when the payload cannot be read. */
export function readPushMessage(payload: string | null): PushMessage {
  if (payload === null) return FALLBACK
  let message: unknown
  try {
    message = JSON.parse(payload)
  }
  catch {
    return FALLBACK
  }
  if (typeof message !== 'object' || message === null) return FALLBACK
  const { title, body, url } = message as Record<string, unknown>
  if (typeof title !== 'string' || title === '') return FALLBACK
  return { title, body: typeof body === 'string' ? body : '', url: typeof url === 'string' ? url : FALLBACK.url }
}

/**
 * The address tapping a notification opens: its URL when it lies inside the
 * app's `scope`, the app's home otherwise (spec, "Notifications"). Outside the
 * scope, iOS would open an in-app browser without the traveller's session.
 */
export function notificationTarget(url: unknown, scope: string): string {
  if (typeof url !== 'string') return scope
  let target: URL
  try {
    target = new URL(url, scope)
  }
  catch {
    return scope
  }
  const home = new URL(scope)
  return target.origin === home.origin && target.pathname.startsWith(home.pathname) ? target.href : scope
}
