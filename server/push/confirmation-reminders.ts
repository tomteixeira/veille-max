import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIRMATION_DEADLINE, dueConfirmationReminders } from '#shared/domain/confirmation-reminder'
import type { Booking } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import { loadBookingsOn, type TravellerBooking } from '#shared/utils/booking-store'
import { addDays, parisDate } from '#shared/utils/paris-time'
import { loadConfirmationReminders } from '#shared/utils/traveller-settings-store'
import { loadStationNames } from '#shared/utils/trip-template-store'
import type { Database } from '#shared/types/database.types'
import type { PushMessage } from '#shared/types/push'
import { notifyTraveller } from './notify-traveller'
import type { PushGateway } from './push-gateway'

// Postgres error code: the notification log already holds this reminder.
const UNIQUE_VIOLATION = '23505'

export interface ConfirmationReminderDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  gateway: PushGateway
  now: Date
}

/**
 * Sends every Confirmation Reminder due at `now` that was not sent yet (spec,
 * "Tick endpoint"), muted trips included. Each one is logged before it is
 * sent, so that two ticks never both send it; when none of the traveller's
 * devices could be reached, or sending failed, the log entry is removed and
 * the next tick tries again. Returns how many reminders were sent.
 */
export async function sendConfirmationReminders({ db, gateway, now }: ConfirmationReminderDependencies): Promise<number> {
  const bookings = await loadBookingsOn(db, addDays(parisDate(now), 1))
  const stationNames = await loadStationNames(db, bookings.flatMap(({ train }) => [train.originCode, train.destinationCode]))
  let sent = 0
  for (const [travellerId, theirs] of byTraveller(bookings)) {
    const due = dueConfirmationReminders(now, theirs, { enabled: await loadConfirmationReminders(db, travellerId) })
    for (const booking of due) {
      if (!await logReminder(db, travellerId, booking)) continue
      // One reminder that fails is tried again at the next tick, and does not hold back the others.
      try {
        const result = await notifyTraveller(db, gateway, travellerId, reminderMessage(booking, stationNames))
        if (result.delivered === 0 && result.failed > 0) await unlogReminder(db, travellerId, booking)
        else sent++
      }
      catch (error) {
        console.error('Confirmation reminder failed', error)
        await unlogReminder(db, travellerId, booking)
      }
    }
  }
  return sent
}

function byTraveller(bookings: readonly TravellerBooking[]): Map<string, Booking[]> {
  const grouped = new Map<string, Booking[]>()
  for (const { travellerId, ...booking } of bookings) grouped.set(travellerId, [...grouped.get(travellerId) ?? [], booking])
  return grouped
}

/** Logs the reminder of `booking`: `false` when it was logged already, by this tick or another. */
async function logReminder(db: SupabaseClient<Database>, travellerId: string, { tripKey, legKind, train }: Booking): Promise<boolean> {
  const { error } = await db.from('notification_log').insert({
    user_id: travellerId,
    kind: 'confirmation_reminder',
    trip_key: tripKey,
    leg_kind: legKind,
    reminder_date: train.date,
  })
  if (error?.code === UNIQUE_VIOLATION) return false
  if (error) throw error
  return true
}

async function unlogReminder(db: SupabaseClient<Database>, travellerId: string, { tripKey, legKind, train }: Booking): Promise<void> {
  const { error } = await db.from('notification_log').delete()
    .eq('user_id', travellerId)
    .eq('kind', 'confirmation_reminder')
    .eq('trip_key', tripKey)
    .eq('leg_kind', legKind)
    .eq('reminder_date', train.date)
  if (error) throw error
}

/** A leg named inside a sentence: « Votre aller de demain ». */
const LEG_NAMES_IN_SENTENCE: Record<LegKind, string> = { outbound: 'aller', return: 'retour' }

/**
 * « Votre aller de demain est à confirmer — Paris Gare de Lyon → Lyon
 * Part-Dieu, 07:00 → 08:56. Confirmez-le sur MAX JEUNE avant 17:00, sinon SNCF
 * l’annule. » Tapping it opens « Trajets à confirmer ».
 */
function reminderMessage({ legKind, train }: Booking, stationNames: Record<string, string>): PushMessage {
  const name = (code: string) => stationNames[code] ?? code
  return {
    title: `Votre ${LEG_NAMES_IN_SENTENCE[legKind]} de demain est à confirmer`,
    body: `${name(train.originCode)} → ${name(train.destinationCode)}, ${train.departureTime} → ${train.arrivalTime}. `
      + `Confirmez-le sur MAX JEUNE avant ${CONFIRMATION_DEADLINE}, sinon SNCF l’annule.`,
    url: '/confirmations',
  }
}
