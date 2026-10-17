import type { SupabaseClient } from '@supabase/supabase-js'
import type { Booking } from '../domain/evaluation'
import type { LegKind } from '../domain/trip-template'
import type { Database } from '../types/database.types'
import type { ParisDate } from './paris-time'
import { bookedTrainFromRow } from './observation-store'

// Reads and writes a traveller's bookings (table `bookings`). With a
// traveller's client, RLS limits every read and write to their own rows.

type Client = SupabaseClient<Database>

const BOOKING_COLUMNS = 'user_id, trip_key, leg_kind, travel_date, train_number, origin_code, destination_code, train_observations!inner (departure_time, arrival_time)'

/** Every booking of `travellerId`, with the booked trains' latest times. */
export async function loadBookings(client: Client, travellerId: string): Promise<Booking[]> {
  const { data, error } = await client.from('bookings').select(BOOKING_COLUMNS).eq('user_id', travellerId).order('travel_date')
  if (error) throw error
  return data.map(toBooking)
}

/** A traveller's booking. */
export interface TravellerBooking extends Booking {
  travellerId: string
}

/** Every booking of a train leaving on `date`, whoever holds it: for the server role. */
export async function loadBookingsOn(client: Client, date: ParisDate): Promise<TravellerBooking[]> {
  const { data, error } = await client.from('bookings').select(BOOKING_COLUMNS).eq('travel_date', date).order('user_id')
  if (error) throw error
  return data.map(row => ({ travellerId: row.user_id, ...toBooking(row) }))
}

type BookingRow = {
  trip_key: string
  leg_kind: LegKind
  travel_date: string
  train_number: string
  origin_code: string
  destination_code: string
  train_observations: { departure_time: string, arrival_time: string }
}

function toBooking(row: BookingRow): Booking {
  return {
    tripKey: row.trip_key,
    legKind: row.leg_kind,
    // The booked train's latest times are its observation's.
    train: bookedTrainFromRow({ ...row, ...row.train_observations }),
  }
}

/**
 * Declares the booking of `travellerId`, who must be the signed-in traveller,
 * replacing the one they held for that leg, if any. The booked train must be
 * one the snapshots listed.
 */
export async function saveBooking(client: Client, travellerId: string, { tripKey, legKind, train }: Booking): Promise<void> {
  const { error } = await client.from('bookings').upsert({
    user_id: travellerId,
    trip_key: tripKey,
    leg_kind: legKind,
    travel_date: train.date,
    train_number: train.trainNumber,
    origin_code: train.originCode,
    destination_code: train.destinationCode,
    booked_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Cancels the booking `travellerId` holds for a leg, if any. */
export async function cancelBooking(client: Client, travellerId: string, tripKey: string, legKind: LegKind): Promise<void> {
  const { error } = await client.from('bookings').delete()
    .eq('user_id', travellerId)
    .eq('trip_key', tripKey)
    .eq('leg_kind', legKind)
  if (error) throw error
}
