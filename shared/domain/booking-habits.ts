import { daysBetween, parisDate } from '../utils/paris-time'
import { isActiveBooking, type Booking } from './evaluation'

// Where the traveller stands with their bookings (spec, user story 64): how
// many they hold against the MAX JEUNE limit, and how long before departure
// they usually declare them.

/** A booking, with when the traveller declared it. */
export interface DeclaredBooking extends Booking {
  declaredAt: Date
}

/** A booking of a leg that has passed, with how many days before its date it was declared. */
export interface PastBooking extends DeclaredBooking {
  daysBefore: number
}

export interface BookingHabits {
  /** How many bookings are held for legs that have not passed, against `MAX_ACTIVE_BOOKINGS`. */
  active: number
  /** How many days before departure the bookings were declared, on average to the nearest day; `null` without any. */
  averageDaysBefore: number | null
  /** The bookings of legs that have passed, the latest first. */
  past: PastBooking[]
}

export function bookingHabits(bookings: readonly DeclaredBooking[], now: Date): BookingHabits {
  const today = parisDate(now)
  // A booking declared once its leg had left counts as declared on the day.
  const withDays = bookings.map(booking => ({ ...booking, daysBefore: Math.max(0, daysBetween(parisDate(booking.declaredAt), booking.train.date)) }))
  const total = withDays.reduce((sum, { daysBefore }) => sum + daysBefore, 0)
  return {
    active: bookings.filter(booking => isActiveBooking(booking, today)).length,
    averageDaysBefore: withDays.length === 0 ? null : Math.round(total / withDays.length),
    past: withDays
      .filter(booking => !isActiveBooking(booking, today))
      .sort((a, b) => b.train.date.localeCompare(a.train.date) || b.train.departureTime.localeCompare(a.train.departureTime)),
  }
}
