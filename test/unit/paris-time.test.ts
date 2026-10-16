import { describe, expect, it } from 'vitest'
import { formatParisLongDay } from '#shared/utils/paris-time'

describe('formatParisLongDay', () => {
  it('writes the day in French with a capitalised weekday', () => {
    expect(formatParisLongDay(new Date('2026-10-16T08:00:00Z'))).toBe('Vendredi 16 octobre')
  })

  it('uses the Paris calendar day, not the UTC one', () => {
    // 22:30 UTC on Thursday is already 00:30 on Friday in Paris (summer time, UTC+2).
    expect(formatParisLongDay(new Date('2026-10-15T22:30:00Z'))).toBe('Vendredi 16 octobre')
  })

  it('follows the switch to winter time', () => {
    // After 2026-10-25 Paris is UTC+1: 23:30 UTC on Thursday 5 November is 00:30 on Friday 6.
    expect(formatParisLongDay(new Date('2026-11-05T23:30:00Z'))).toBe('Vendredi 6 novembre')
    expect(formatParisLongDay(new Date('2026-11-05T22:30:00Z'))).toBe('Jeudi 5 novembre')
  })
})
