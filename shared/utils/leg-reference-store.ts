import type { SupabaseClient } from '@supabase/supabase-js'
import type { LegReference } from '../domain/evaluation'
import type { Database } from '../types/database.types'

// Reads and writes a traveller's leg references (table `leg_references`).
// With a traveller's client, RLS limits every read and write to their own rows.

type Client = SupabaseClient<Database>

/** The reference best candidate of every leg of `travellerId` evaluated so far. */
export async function loadLegReferences(client: Client, travellerId: string): Promise<LegReference[]> {
  const { data, error } = await client.from('leg_references')
    .select('trip_key, leg_kind, travel_date, train_number, origin_code, destination_code, departure_time, arrival_time')
    .eq('user_id', travellerId)
  if (error) throw error

  return data.map(row => ({
    tripKey: row.trip_key,
    legKind: row.leg_kind,
    // The train's columns are all set, or all null.
    train: row.travel_date === null
      ? null
      : {
          date: row.travel_date,
          trainNumber: row.train_number!,
          originCode: row.origin_code!,
          destinationCode: row.destination_code!,
          // Postgres `time` reads « HH:MM:SS »; the domain uses « HH:MM ».
          departureTime: row.departure_time!.slice(0, 5),
          arrivalTime: row.arrival_time!.slice(0, 5),
        },
  }))
}

/** Stores the references of `travellerId` evaluated against snapshot `snapshotId`, replacing those of the same legs. */
export async function saveLegReferences(client: Client, travellerId: string, snapshotId: number, references: readonly LegReference[]): Promise<void> {
  if (references.length === 0) return

  const { error } = await client.from('leg_references').upsert(references.map(({ tripKey, legKind, train }) => ({
    user_id: travellerId,
    trip_key: tripKey,
    leg_kind: legKind,
    snapshot_id: snapshotId,
    travel_date: train?.date ?? null,
    train_number: train?.trainNumber ?? null,
    origin_code: train?.originCode ?? null,
    destination_code: train?.destinationCode ?? null,
    departure_time: train?.departureTime ?? null,
    arrival_time: train?.arrivalTime ?? null,
    updated_at: new Date().toISOString(),
  })), { onConflict: 'user_id,trip_key,leg_kind' })
  if (error) throw error
}
