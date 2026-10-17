/**
 * Confirmation Reminders (CONTEXT.md): SNCF cancels a MAX JEUNE booking that
 * is not confirmed in the traveller's MAX JEUNE account before 17:00 the day
 * before the train. From noon that day, the traveller is reminded of each
 * booked leg, muted or not (spec, "Notifications").
 */
import { addDays, parisDate, parisTimeOfDay } from '../utils/paris-time'
import type { Booking } from './evaluation'
import type { LocalTime } from './trip-template'

/** When a booked leg's reminder is due, Paris time, the day before it. */
export const REMINDER_TIME: LocalTime = '12:00'

/** SNCF's deadline to confirm a booking, Paris time, the day before its train. */
export const CONFIRMATION_DEADLINE: LocalTime = '17:00'

/** « Mes voyages » of MAX JEUNE, where a logged-in traveller confirms their trips (docs/research/tgvmax-data-source.md). */
export const MAX_JEUNE_CONFIRMATION_URL = 'https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages'

/**
 * The bookings to confirm today: those whose train leaves tomorrow in Paris,
 * in departure order. « Trajets à confirmer » lists them at any time of the
 * day, whether reminders are on or not.
 */
export function bookingsToConfirm(now: Date, bookings: readonly Booking[]): Booking[] {
  const tomorrow = addDays(parisDate(now), 1)
  return bookings
    .filter(booking => booking.train.date === tomorrow)
    .sort((a, b) => a.train.departureTime.localeCompare(b.train.departureTime))
}

/**
 * The Confirmation Reminders due at `now`, one per booking to confirm: from
 * noon until SNCF's 17:00 deadline, after which reminding would be too late.
 * None when the traveller turned reminders off (`enabled: false`).
 */
export function dueConfirmationReminders(now: Date, bookings: readonly Booking[], { enabled = true }: { enabled?: boolean }): Booking[] {
  const time = parisTimeOfDay(now)
  if (!enabled || time < REMINDER_TIME || time >= CONFIRMATION_DEADLINE) return []
  return bookingsToConfirm(now, bookings)
}

/**
 * The MAX JEUNE confirmation page, through `x-safari-https://` so that an
 * installed app opens it in Safari, where the traveller is logged in to MAX
 * JEUNE, and as plain https where that scheme does not work.
 */
export function maxJeuneConfirmationLinks(): { safari: string, https: string } {
  return { safari: `x-safari-${MAX_JEUNE_CONFIRMATION_URL}`, https: MAX_JEUNE_CONFIRMATION_URL }
}
