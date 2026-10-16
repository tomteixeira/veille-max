import { createHash, timingSafeEqual } from 'node:crypto'

/** The header carrying the secret shared with the `pg_cron` job (migration `tick_schedule`). */
export const TICK_SECRET_HEADER = 'x-tick-secret'

/** Whether a tick call carries the shared secret. No call passes while `expected` is empty. */
export function isTickAuthorized(provided: string | undefined, expected: string): boolean {
  if (!expected || !provided) return false
  // Compares digests, which have the same length, in constant time.
  return timingSafeEqual(digest(provided), digest(expected))
}

function digest(text: string): Buffer {
  return createHash('sha256').update(text).digest()
}
