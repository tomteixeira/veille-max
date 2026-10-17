import { describe, expect, it } from 'vitest'
import { bookingHabits, type DeclaredBooking } from '#shared/domain/booking-habits'
import type { LegKind } from '#shared/domain/trip-template'

// Wednesday 28 October 2026, at noon in Paris.
const wednesday = new Date('2026-10-28T11:00:00Z')

/** A booking of a train on `date`, declared at `declaredAt`. */
function booking(tripKey: string, legKind: LegKind, date: string, declaredAt: string): DeclaredBooking {
  return {
    tripKey,
    legKind,
    train: { date, trainNumber: '6603', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '07:04', arrivalTime: '09:00' },
    declaredAt: new Date(declaredAt),
  }
}

describe('booking habits', () => {
  it('count the bookings held for legs that have not passed', () => {
    const habits = bookingHabits([
      booking('2026-W43', 'outbound', '2026-10-23', '2026-10-14T18:00:00Z'),
      booking('2026-W44', 'return', '2026-10-28', '2026-10-20T18:00:00Z'),
      booking('2026-W45', 'outbound', '2026-11-06', '2026-10-25T18:00:00Z'),
    ], wednesday)

    expect(habits.active).toBe(2)
  })

  it('give how many days before departure each past booking was declared, the latest first', () => {
    const habits = bookingHabits([
      // Declared on Wednesday 14 for Friday 23: D-9.
      booking('2026-W43', 'outbound', '2026-10-23', '2026-10-14T18:00:00Z'),
      // Declared at 00:30 in Paris on Thursday 22 for Sunday 25: D-3.
      booking('2026-W43', 'return', '2026-10-25', '2026-10-21T22:30:00Z'),
      booking('2026-W45', 'outbound', '2026-11-06', '2026-10-25T18:00:00Z'),
    ], wednesday)

    expect(habits.past.map(({ tripKey, legKind, daysBefore }) => [tripKey, legKind, daysBefore])).toEqual([
      ['2026-W43', 'return', 3],
      ['2026-W43', 'outbound', 9],
    ])
  })

  it('average the days before departure of every booking, past or active, to the nearest day', () => {
    const habits = bookingHabits([
      booking('2026-W43', 'outbound', '2026-10-23', '2026-10-14T18:00:00Z'),
      booking('2026-W43', 'return', '2026-10-25', '2026-10-21T22:30:00Z'),
      // D-12.
      booking('2026-W45', 'outbound', '2026-11-06', '2026-10-25T18:00:00Z'),
    ], wednesday)

    // (9 + 3 + 12) / 3.
    expect(habits.averageDaysBefore).toBe(8)
  })

  it('count a booking declared after its leg left as declared on the day', () => {
    const habits = bookingHabits([booking('2026-W43', 'outbound', '2026-10-23', '2026-10-24T08:00:00Z')], wednesday)

    expect(habits.past[0]?.daysBefore).toBe(0)
    expect(habits.averageDaysBefore).toBe(0)
  })

  it('have no average without any booking', () => {
    expect(bookingHabits([], wednesday)).toEqual({ active: 0, averageDaysBefore: null, past: [] })
  })
})
