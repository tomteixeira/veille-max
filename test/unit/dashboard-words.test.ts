import { describe, expect, it } from 'vitest'
import { HOUR_BANDS, type SlotGrid } from '#shared/domain/opening-history'
import type { LegHistoryColumn } from '#shared/domain/leg-history'
import { bandLabel, bookedTripsText, bookingPaceText, daysBeforeLabel, historyLegLabel, legHistoryHeadline, lifetimeHeadline, lifetimeLabel, curveHeadline, slotHeadline, trainsText, weekdaysLabel } from '../../app/utils/dashboard-words'

/** A leg history column with `candidates` candidates, `daysBefore` days before departure; its best one does not matter to the words. */
function column(daysBefore: number, candidates: number): LegHistoryColumn {
  return { snapshotId: daysBefore, day: '2026-10-01', daysBefore, candidates, best: null }
}

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

  it('tells the average booking day', () => {
    expect(bookingPaceText(9)).toBe('Vous réservez en moyenne à J-9.')
    expect(bookingPaceText(0)).toBe('Vous réservez en moyenne le jour du départ.')
    expect(bookingPaceText(null)).toBe('Votre rythme de réservation apparaîtra après votre première réservation.')
  })

  it('names a leg on its history chip', () => {
    expect(historyLegLabel({ kind: 'outbound', date: '2026-10-23' })).toBe('Aller · Ven 23 oct.')
    expect(historyLegLabel({ kind: 'return', date: '2026-11-01' })).toBe('Retour · Dim 1 nov.')
  })

  it('names the day a snapshot was taken, before departure', () => {
    expect(daysBeforeLabel(6)).toBe('J-6')
    expect(daysBeforeLabel(0)).toBe('Départ')
  })

  it('captions the bookings count', () => {
    expect(bookedTripsText(0)).toBe('trajet réservé en ce moment')
    expect(bookedTripsText(2)).toBe('trajets réservés en ce moment')
  })

  it('counts trains', () => {
    expect(trainsText(0)).toBe('aucun train')
    expect(trainsText(1)).toBe('1 train')
    expect(trainsText(3)).toBe('3 trains')
  })

  it('concludes a leg’s history with its latest snapshot until it leaves, then with its peak', () => {
    const upcoming = { kind: 'outbound', date: '2026-10-23', past: false } as const
    const past = { kind: 'return', date: '2026-10-11', past: true } as const

    expect(legHistoryHeadline({ ...upcoming, columns: [column(7, 4), column(6, 3)] })).toBe('Aller du vendredi 23 octobre : 3 trains au dernier instantané.')
    expect(legHistoryHeadline({ ...upcoming, columns: [column(7, 0)] })).toBe('Aller du vendredi 23 octobre : aucun train au dernier instantané.')
    expect(legHistoryHeadline({ ...past, columns: [column(9, 1), column(8, 5), column(3, 5), column(2, 0)] })).toBe('Retour du dimanche 11 octobre : jusqu’à 5 trains, à J-8.')
    expect(legHistoryHeadline({ ...past, columns: [column(9, 0)] })).toBe('Retour du dimanche 11 octobre : aucun train n’a eu de place.')
    expect(legHistoryHeadline({ ...past, columns: [] })).toBeNull()
  })
})
