import type { SupabaseClient } from '@supabase/supabase-js'
import type { Booking } from '../domain/evaluation'
import type { LegKind } from '../domain/trip-template'
import type { Database } from '../types/database.types'

// Reads and writes a traveller's bookings (table `bookings`). With a
// traveller's client, RLS limits every read and write to their own rows.

type Client = SupabaseClient<Database>

/** Every booking of `travellerId`, with the booked trains' latest times. */
export async function loadBookings(client: Client, travellerId: string): Promise<Booking[]> {
  const { data, error } = await client.from('bookings')
    .select('trip_key, leg_kind, travel_date, train_number, origin_code, destination_code, train_observations!inner (departure_time, arrival_time)')
    .eq('user_id', travellerId)
    .order('travel_date')
  if (error) throw error

  return data.map(row => ({
    tripKey: row.trip_key,
    legKind: row.leg_kind,
    train: {
      date: row.travel_date,
      trainNumber: row.train_number,
      originCode: row.origin_code,
      destinationCode: row.destination_code,
      // Postgres `time` reads « HH:MM:SS »; the domain uses « HH:MM ».
      departureTime: row.train_observations.departure_time.slice(0, 5),
      arrivalTime: row.train_observations.arrival_time.slice(0, 5),
    },
  }))
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
