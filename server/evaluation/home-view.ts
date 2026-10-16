import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookedTrain, ImprovementKind, Trip } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'
import type { Database } from '#shared/types/database.types'
import { evaluateTraveller, type TravellerEvaluation } from './traveller-evaluation'

/** An improvement of the latest snapshot, as « Nouveautés » lists it. */
export interface NewsItem {
  tripKey: string
  legKind: LegKind
  date: ParisDate
  kind: ImprovementKind
  /** The best candidate the improvement brought. */
  train: BookedTrain
}

/** What the home screen shows (spec, "UI"): the traveller's evaluation, and this morning's improvements. */
export interface HomeView extends Omit<TravellerEvaluation, 'snapshotId' | 'references' | 'improvements'> {
  /** The latest snapshot's improvements on the legs that are tracked and not muted, soonest first. */
  news: NewsItem[]
}

/** The home view of `travellerId` at `now`. `client` is the traveller's own client, so RLS limits it to their rows. */
export async function loadHomeView(client: SupabaseClient<Database>, travellerId: string, now: Date): Promise<HomeView> {
  const { snapshotId, references: _references, improvements: _improvements, ...evaluation } = await evaluateTraveller(client, travellerId, now)
  const news = snapshotId === null ? [] : await loadNews(client, travellerId, snapshotId, evaluation.trips)
  return { ...evaluation, news }
}

/** The improvements logged for `travellerId` in snapshot `snapshotId`, on the legs of `trips` that are not muted now. */
async function loadNews(client: SupabaseClient<Database>, travellerId: string, snapshotId: number, trips: readonly Trip[]): Promise<NewsItem[]> {
  const { data, error } = await client.from('notification_log')
    .select('trip_key, leg_kind, improvement_kind, travel_date, train_number, origin_code, destination_code, departure_time, arrival_time')
    .eq('user_id', travellerId)
    .eq('snapshot_id', snapshotId)
    .not('improvement_kind', 'is', null)
    .order('travel_date')
    .order('departure_time')
  if (error) throw error

  const shown = (tripKey: string, legKind: LegKind) => {
    const leg = trips.find(trip => trip.key === tripKey)?.legs[legKind]
    return leg !== undefined && !leg.muted
  }
  // An improvement's columns are all set.
  return data.filter(row => shown(row.trip_key, row.leg_kind)).map(row => ({
    tripKey: row.trip_key,
    legKind: row.leg_kind,
    date: row.travel_date!,
    kind: row.improvement_kind as ImprovementKind,
    train: {
      date: row.travel_date!,
      trainNumber: row.train_number!,
      originCode: row.origin_code!,
      destinationCode: row.destination_code!,
      // Postgres `time` reads « HH:MM:SS »; the domain uses « HH:MM ».
      departureTime: row.departure_time!.slice(0, 5),
      arrivalTime: row.arrival_time!.slice(0, 5),
    },
  }))
}
