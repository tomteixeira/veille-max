import { describe, expect, it } from 'vitest'
import { addDays, formatParisLongDay, formatParisSnapshotTime, parisDate, parisTimeOfDay } from '#shared/utils/paris-time'

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

describe('parisDate', () => {
  it('gives the Paris calendar day of an instant', () => {
    expect(parisDate(new Date('2026-10-16T08:00:00Z'))).toBe('2026-10-16')
    expect(parisDate(new Date('2026-10-15T22:30:00Z'))).toBe('2026-10-16')
    expect(parisDate(new Date('2026-11-05T22:30:00Z'))).toBe('2026-11-05')
  })
})

describe('addDays', () => {
  it('moves a calendar day across months and years', () => {
    expect(addDays('2026-10-16', 30)).toBe('2026-11-15')
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19')
  })

  it('counts calendar days, not 24-hour periods, across the switch to winter time', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('formatParisSnapshotTime', () => {
  it('writes the day and the Paris time of a snapshot', () => {
    expect(formatParisSnapshotTime(new Date('2026-10-16T04:24:09Z'))).toBe('16 octobre, 06:24')
  })

  it('follows the switch to winter time', () => {
    expect(formatParisSnapshotTime(new Date('2026-11-02T05:24:00Z'))).toBe('2 novembre, 06:24')
  })
})

describe('parisTimeOfDay', () => {
  it('gives the Paris time of day of an instant, in summer and in winter time', () => {
    expect(parisTimeOfDay(new Date('2026-10-22T10:05:00Z'))).toBe('12:05')
    expect(parisTimeOfDay(new Date('2026-10-29T11:05:00Z'))).toBe('12:05')
    expect(parisTimeOfDay(new Date('2026-10-15T22:00:00Z'))).toBe('00:00')
  })
})
