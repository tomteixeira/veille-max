import { describe, expect, it } from 'vitest'
import { HOUR_BANDS, type SlotGrid } from '#shared/domain/opening-history'
import { bandLabel, lifetimeHeadline, lifetimeLabel, curveHeadline, slotHeadline, weekdaysLabel } from '../../app/utils/dashboard-words'

/** A slot grid whose best slot is `best`; its rows do not matter to the words. */
function grid(best: SlotGrid['best']): SlotGrid {
  return { bands: HOUR_BANDS, rows: [], best }
}

describe('dashboard words', () => {
  it('concludes the opening curve with its waves', () => {
    expect(curveHeadline([29, 11, 3])).toBe('Les places sortent en trois vagues : J-29, J-11 et J-3.')
    expect(curveHeadline([29, 3])).toBe('Les places sortent en deux vagues : J-29 et J-3.')
    expect(curveHeadline([11])).toBe('Les places sortent surtout à J-11.')
    expect(curveHeadline([])).toBeNull()
  })

  it('concludes the slots with the best one', () => {
    expect(slotHeadline(grid({ weekday: 7, bandIndex: 4, percent: 50 }))).toBe('Meilleur créneau : le dimanche de 17 h à 20 h, où 50 % des trains ont une place.')
    expect(slotHeadline(grid({ weekday: 5, bandIndex: 0, percent: 12 }))).toBe('Meilleur créneau : le vendredi avant 8 h, où 12 % des trains ont une place.')
    expect(slotHeadline(grid(null))).toBeNull()
  })

  it('names the hour bands', () => {
    expect(bandLabel({ fromHour: 0, toHour: 8 })).toBe('< 8 h')
    expect(bandLabel({ fromHour: 8, toHour: 11 })).toBe('8–11 h')
    expect(bandLabel({ fromHour: 20, toHour: 24 })).toBe('20 h +')
  })

  it('concludes the lifetimes with the seats gone within a day', () => {
    const buckets = [
      { fromDays: 0, toDays: 0, openings: 9, percent: 46 },
      { fromDays: 7, toDays: null, openings: 2, percent: 54 },
    ]
    expect(lifetimeHeadline({ buckets, total: 11 })).toBe('46 % des places ont disparu dès le lendemain matin.')
    expect(lifetimeHeadline({ buckets: [], total: 0 })).toBeNull()
  })

  it('names the lifetime ranges', () => {
    expect(lifetimeLabel({ fromDays: 0, toDays: 0 })).toBe('< 1 j')
    expect(lifetimeLabel({ fromDays: 2, toDays: 2 })).toBe('2 j')
    expect(lifetimeLabel({ fromDays: 3, toDays: 6 })).toBe('3–6 j')
    expect(lifetimeLabel({ fromDays: 7, toDays: null })).toBe('7 j +')
  })

  it('names the trip weekdays filter', () => {
    expect(weekdaysLabel([5, 7])).toBe('Vendredi & dimanche')
    expect(weekdaysLabel([4, 5, 7])).toBe('Jeudi, vendredi & dimanche')
    expect(weekdaysLabel([6])).toBe('Samedi')
  })
})
