import { describe, expect, it } from 'vitest'
import {
  bookingsToConfirm,
  dueConfirmationReminders,
  MAX_JEUNE_CONFIRMATION_URL,
  maxJeuneConfirmationLinks,
} from '#shared/domain/confirmation-reminder'
import type { Booking } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'

const parisLyonToPartDieu = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const partDieuToParisLyon = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

function booking(tripKey: string, legKind: LegKind, date: string, trainNumber = '6603'): Booking {
  const route = legKind === 'outbound' ? parisLyonToPartDieu : partDieuToParisLyon
  return { tripKey, legKind, train: { date, trainNumber, ...route, departureTime: '07:00', arrivalTime: '08:56' } }
}

// The trip of week 43: out on Friday 23 October 2026, back on Sunday 25.
const fridayOut = booking('2026-W43', 'outbound', '2026-10-23')
const sundayBack = booking('2026-W43', 'return', '2026-10-25', '6680')
// The trip of week 44: out on Friday 30 October, after the switch to winter time.
const nextFridayOut = booking('2026-W44', 'outbound', '2026-10-30', '6605')
const bookings = [fridayOut, sundayBack, nextFridayOut]

/** The trains of the reminders due at `instant`. */
function dueAt(instant: string, settings: { enabled?: boolean } = {}) {
  return dueConfirmationReminders(new Date(instant), bookings, settings).map(due => `${due.tripKey} ${due.legKind}`)
}

describe('confirmation reminders', () => {
  it('are due from noon Paris the day before a booked leg, one per booking', () => {
    // Thursday 22 October, summer time (UTC+2).
    expect(dueAt('2026-10-22T09:59:00Z')).toEqual([])
    expect(dueAt('2026-10-22T10:00:00Z')).toEqual(['2026-W43 outbound'])
    expect(dueAt('2026-10-22T10:05:00Z')).toEqual(['2026-W43 outbound'])
  })

  it('are no longer due once SNCF’s 17:00 deadline has passed', () => {
    expect(dueAt('2026-10-22T14:59:00Z')).toEqual(['2026-W43 outbound'])
    expect(dueAt('2026-10-22T15:00:00Z')).toEqual([])
    expect(dueAt('2026-10-22T21:00:00Z')).toEqual([])
  })

  it('are not due on the day of the leg itself, nor two days before', () => {
    expect(dueAt('2026-10-21T10:30:00Z')).toEqual([])
    expect(dueAt('2026-10-23T10:30:00Z')).toEqual([])
  })

  it('follow noon in Paris on the day of the switch to winter time', () => {
    // Sunday 25 October: Paris moves from UTC+2 to UTC+1 at 03:00, so noon is 11:00 UTC.
    const mondayOut = booking('2026-W44', 'outbound', '2026-10-26')
    const on = (instant: string) => dueConfirmationReminders(new Date(instant), [mondayOut], {}).length

    expect(on('2026-10-25T10:05:00Z')).toBe(0)
    expect(on('2026-10-25T10:59:00Z')).toBe(0)
    expect(on('2026-10-25T11:00:00Z')).toBe(1)
    // 17:00 Paris is 16:00 UTC.
    expect(on('2026-10-25T15:59:00Z')).toBe(1)
    expect(on('2026-10-25T16:00:00Z')).toBe(0)
  })

  it('follow noon in Paris the day before the switch, and in winter time after it', () => {
    // Saturday 24 October, still UTC+2: noon is 10:00 UTC.
    expect(dueAt('2026-10-24T10:00:00Z')).toEqual(['2026-W43 return'])
    // Thursday 29 October, UTC+1: noon is 11:00 UTC.
    expect(dueAt('2026-10-29T10:30:00Z')).toEqual([])
    expect(dueAt('2026-10-29T11:00:00Z')).toEqual(['2026-W44 outbound'])
  })

  it('follow noon in Paris around the switch to summer time', () => {
    // Sunday 28 March 2027: Paris moves from UTC+1 to UTC+2 at 02:00, so noon is 10:00 UTC.
    const mondayOut = booking('2027-W13', 'outbound', '2027-03-29')
    const on = (instant: string) => dueConfirmationReminders(new Date(instant), [mondayOut], {}).length

    expect(on('2027-03-28T09:59:00Z')).toBe(0)
    expect(on('2027-03-28T10:00:00Z')).toBe(1)
  })

  it('are never due when the traveller turned them off', () => {
    expect(dueAt('2026-10-22T10:05:00Z', { enabled: false })).toEqual([])
    expect(dueAt('2026-10-22T10:05:00Z', { enabled: true })).toEqual(['2026-W43 outbound'])
  })

  it('are due for every booked leg of tomorrow, whatever the trip', () => {
    // A customised trip can leave on the day another comes back.
    const sameDay = booking('2026-W44', 'outbound', '2026-10-25', '6611')
    const due = dueConfirmationReminders(new Date('2026-10-24T10:30:00Z'), [...bookings, sameDay], {})

    expect(due).toEqual([sundayBack, sameDay])
  })
})

describe('bookings to confirm', () => {
  it('are the legs booked for tomorrow in Paris, at any time of the day and with reminders off', () => {
    expect(bookingsToConfirm(new Date('2026-10-22T05:00:00Z'), bookings)).toEqual([fridayOut])
    expect(bookingsToConfirm(new Date('2026-10-22T20:00:00Z'), bookings)).toEqual([fridayOut])
    // 22:30 UTC on Thursday is already Friday in Paris: Saturday's legs come next, there are none.
    expect(bookingsToConfirm(new Date('2026-10-22T22:30:00Z'), bookings)).toEqual([])
  })

  it('come in departure order', () => {
    const early = { ...fridayOut, legKind: 'outbound' as const, tripKey: '2026-W44', train: { ...fridayOut.train, trainNumber: '6601', departureTime: '06:00' } }
    expect(bookingsToConfirm(new Date('2026-10-22T08:00:00Z'), [fridayOut, early])).toEqual([early, fridayOut])
  })
})

describe('the MAX JEUNE confirmation link', () => {
  it('opens « Mes voyages » of MAX JEUNE in Safari, with a plain https fallback', () => {
    expect(MAX_JEUNE_CONFIRMATION_URL).toBe('https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages')
    expect(maxJeuneConfirmationLinks()).toEqual({
      safari: 'x-safari-https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages',
      https: 'https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages',
    })
  })
})
