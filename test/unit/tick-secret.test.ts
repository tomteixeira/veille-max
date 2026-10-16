import { describe, expect, it } from 'vitest'
import { isTickAuthorized } from '../../server/tick/tick-secret'

const SECRET = 'a-long-random-secret-shared-with-pg-cron'

describe('tick secret', () => {
  it('lets a call with the shared secret through', () => {
    expect(isTickAuthorized(SECRET, SECRET)).toBe(true)
  })

  it('rejects a call without the secret, or with another one', () => {
    expect(isTickAuthorized(undefined, SECRET)).toBe(false)
    expect(isTickAuthorized('', SECRET)).toBe(false)
    expect(isTickAuthorized('wrong', SECRET)).toBe(false)
    expect(isTickAuthorized(`${SECRET}x`, SECRET)).toBe(false)
  })

  it('rejects every call while no secret is configured', () => {
    expect(isTickAuthorized('', '')).toBe(false)
    expect(isTickAuthorized(undefined, '')).toBe(false)
  })
})
