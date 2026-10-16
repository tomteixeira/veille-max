import type { SupabaseClient } from '@supabase/supabase-js'
import { sameRoute, type BookedTrain, type TrainObservation } from '../domain/evaluation'
import type { Route } from '../domain/trip-template'
import type { Database, Tables } from '../types/database.types'
import type { ParisDate } from './paris-time'

// Reads the train observations (tables `train_observations` and `openings`),
// which every signed-in traveller may read.

// The Data API returns at most this many rows per request (`max_rows`, supabase/config.toml).
const PAGE_SIZE = 1000

/**
 * The trains with an open seat in snapshot `snapshotId`, on `routes`, from
 * `dates.from` to `dates.to`.
 */
export async function loadOpenTrains(
  client: SupabaseClient<Database>,
  snapshotId: number,
  routes: readonly Route[],
  dates: { from: ParisDate, to: ParisDate },
): Promise<TrainObservation[]> {
  if (routes.length === 0) return []

  // Only the trains with an open seat: an opening that reaches the snapshot.
  // Narrowed to the routes' stations here, to the routes themselves below.
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('train_observations')
      .select('travel_date, train_number, origin_code, destination_code, departure_time, arrival_time, openings!inner (last_snapshot_id)')
      .eq('last_snapshot_id', snapshotId)
      .eq('openings.last_snapshot_id', snapshotId)
      .gte('travel_date', dates.from)
      .lte('travel_date', dates.to)
      .in('origin_code', [...new Set(routes.map(route => route.originCode))])
      .in('destination_code', [...new Set(routes.map(route => route.destinationCode))])
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return rows
    .map(row => ({ ...trainObservation(row), open: true }))
    .filter(train => routes.some(route => sameRoute(route, train)))
}

/**
 * Every train snapshot `snapshotId` lists on `routes` on `date`, whether or
 * not it has an open seat.
 */
export async function loadTrainsOfDay(
  client: SupabaseClient<Database>,
  snapshotId: number,
  routes: readonly Route[],
  date: ParisDate,
): Promise<TrainObservation[]> {
  if (routes.length === 0) return []

  // An opening reaching the snapshot means an open seat. Narrowed to the
  // routes' stations here, to the routes themselves below.
  const { data, error } = await client.from('train_observations')
    .select('travel_date, train_number, origin_code, destination_code, departure_time, arrival_time, openings (last_snapshot_id)')
    .eq('last_snapshot_id', snapshotId)
    .eq('openings.last_snapshot_id', snapshotId)
    .eq('travel_date', date)
    .in('origin_code', [...new Set(routes.map(route => route.originCode))])
    .in('destination_code', [...new Set(routes.map(route => route.destinationCode))])
    .order('departure_time')
    .limit(PAGE_SIZE)
  if (error) throw error

  return data
    .map(row => ({ ...trainObservation(row), open: row.openings.length > 0 }))
    .filter(train => routes.some(route => sameRoute(route, train)))
}

type ObservationRow = Pick<Tables<'train_observations'>, 'travel_date' | 'train_number' | 'origin_code' | 'destination_code' | 'departure_time' | 'arrival_time'>

function trainObservation(row: ObservationRow): BookedTrain {
  return {
    date: row.travel_date,
    trainNumber: row.train_number,
    originCode: row.origin_code,
    destinationCode: row.destination_code,
    // Postgres `time` reads « HH:MM:SS »; the domain uses « HH:MM ».
    departureTime: row.departure_time.slice(0, 5),
    arrivalTime: row.arrival_time.slice(0, 5),
  }
}
