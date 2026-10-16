import { describe, expect, it } from 'vitest'
import { seatReleaseDashboard, type SeatReleaseHistory } from '#shared/domain/seat-release'

const FRIDAY = 5
const SATURDAY = 6
const SUNDAY = 7

function history(partial: Partial<SeatReleaseHistory>): SeatReleaseHistory {
  return { releases: [], slots: [], lifetimes: [], ...partial }
}

/** Openings that started `daysBefore` days before departure, on Fridays. */
function releasesOnFriday(counts: Record<number, number>): SeatReleaseHistory['releases'] {
  return Object.entries(counts).map(([daysBefore, openings]) => ({ weekday: FRIDAY, daysBefore: Number(daysBefore), openings }))
}

describe('seat release dashboard', () => {
  describe('release curve', () => {
    it('counts the openings that started on each day before departure, from D-30 to D-0, on the chosen weekdays only', () => {
      const { release } = seatReleaseDashboard(history({
        releases: [
          { weekday: FRIDAY, daysBefore: 29, openings: 4 },
          { weekday: SUNDAY, daysBefore: 29, openings: 2 },
          { weekday: SATURDAY, daysBefore: 29, openings: 9 },
          { weekday: FRIDAY, daysBefore: 3, openings: 1 },
        ],
      }), [FRIDAY, SUNDAY])

      expect(release.columns).toHaveLength(31)
      expect(release.columns[0]).toEqual({ daysBefore: 30, openings: 0 })
      expect(release.columns[1]).toEqual({ daysBefore: 29, openings: 6 })
      expect(release.columns[27]).toEqual({ daysBefore: 3, openings: 1 })
      expect(release.columns[30]).toEqual({ daysBefore: 0, openings: 0 })
      expect(release.total).toBe(7)
    })

    it('counts every weekday when the filter is « all »', () => {
      const { release } = seatReleaseDashboard(history({
        releases: [{ weekday: FRIDAY, daysBefore: 29, openings: 4 }, { weekday: SATURDAY, daysBefore: 29, openings: 9 }],
      }), 'all')

      expect(release.total).toBe(13)
    })

    it('finds the waves: up to three peaks, earliest first, ignoring bumps under a quarter of the highest', () => {
      // The release pattern of the prototype: waves at D-29, D-11 and D-3, small bumps in between.
      const pattern = [1, 16, 4, 3, 2, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 2, 3, 5, 11, 6, 3, 2, 3, 2, 3, 5, 12, 7, 3, 1]
      const { release } = seatReleaseDashboard(history({
        releases: releasesOnFriday(Object.fromEntries(pattern.map((openings, index) => [30 - index, openings]))),
      }), 'all')

      expect(release.peaks).toEqual([29, 11, 3])
    })

    it('keeps the three highest peaks when there are more', () => {
      const { release } = seatReleaseDashboard(history({
        releases: releasesOnFriday({ 29: 10, 20: 6, 11: 8, 3: 9 }),
      }), 'all')

      expect(release.peaks).toEqual([29, 11, 3])
    })

    it('takes the first day of a plateau as its peak', () => {
      const { release } = seatReleaseDashboard(history({ releases: releasesOnFriday({ 12: 5, 11: 5 }) }), 'all')

      expect(release.peaks).toEqual([12])
    })

    it('has no peak without any opening', () => {
      expect(seatReleaseDashboard(history({}), 'all').release).toMatchObject({ total: 0, peaks: [] })
    })
  })

  describe('slots', () => {
    it('gives the share of train-mornings with an open seat per weekday and departure-hour band', () => {
      const { slots } = seatReleaseDashboard(history({
        slots: [
          // Friday 07:xx and 06:xx trains share the first band.
          { weekday: FRIDAY, hour: 6, listed: 10, open: 1 },
          { weekday: FRIDAY, hour: 7, listed: 10, open: 4 },
          { weekday: FRIDAY, hour: 18, listed: 8, open: 2 },
          { weekday: SUNDAY, hour: 21, listed: 3, open: 2 },
          { weekday: SATURDAY, hour: 9, listed: 5, open: 5 },
        ],
      }), [FRIDAY, SUNDAY])

      expect(slots.bands).toEqual([
        { fromHour: 0, toHour: 8 },
        { fromHour: 8, toHour: 11 },
        { fromHour: 11, toHour: 14 },
        { fromHour: 14, toHour: 17 },
        { fromHour: 17, toHour: 20 },
        { fromHour: 20, toHour: 24 },
      ])
      expect(slots.rows).toEqual([
        { weekday: FRIDAY, percents: [25, null, null, null, 25, null] },
        { weekday: SUNDAY, percents: [null, null, null, null, null, 67] },
      ])
      expect(slots.best).toEqual({ weekday: SUNDAY, band: 5, percent: 67 })
    })

    it('shows every weekday, Monday first, when the filter is « all »', () => {
      const { slots } = seatReleaseDashboard(history({ slots: [{ weekday: SUNDAY, hour: 9, listed: 2, open: 1 }] }), 'all')

      expect(slots.rows.map(row => row.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('has no best slot without any listed train', () => {
      expect(seatReleaseDashboard(history({}), [FRIDAY]).slots.best).toBeNull()
    })
  })

  describe('lifetimes', () => {
    it('spreads the openings by how many days they lasted, in shares that add up to 100', () => {
      const { lifetimes } = seatReleaseDashboard(history({
        lifetimes: [
          { weekday: FRIDAY, days: 0, openings: 4 },
          { weekday: SUNDAY, days: 1, openings: 2 },
          { weekday: FRIDAY, days: 4, openings: 1 },
          { weekday: FRIDAY, days: 6, openings: 1 },
          { weekday: SUNDAY, days: 12, openings: 1 },
          { weekday: SATURDAY, days: 0, openings: 50 },
        ],
      }), [FRIDAY, SUNDAY])

      expect(lifetimes.total).toBe(9)
      expect(lifetimes.buckets).toEqual([
        { fromDays: 0, toDays: 0, openings: 4, percent: 45 },
        { fromDays: 1, toDays: 1, openings: 2, percent: 22 },
        { fromDays: 2, toDays: 2, openings: 0, percent: 0 },
        { fromDays: 3, toDays: 6, openings: 2, percent: 22 },
        { fromDays: 7, toDays: null, openings: 1, percent: 11 },
      ])
    })

    it('has empty buckets without any opening', () => {
      const { lifetimes } = seatReleaseDashboard(history({}), 'all')

      expect(lifetimes.total).toBe(0)
      expect(lifetimes.buckets.every(bucket => bucket.percent === 0)).toBe(true)
    })
  })
})
