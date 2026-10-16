import type { Route } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'
import type { SnapshotSource, SnapshotTrain } from '../../../server/snapshots/snapshot-source'
import { admin } from './travellers'

/** A frozen snapshot: when SNCF took it, and every train it lists, on any route and date. */
export interface FixtureSnapshot {
  processedAt: Date
  trains: SnapshotTrain[]
}

/**
 * A `SnapshotSource` that publishes `snapshot` until `publish` replaces it,
 * answering like the dataset's filtered export, and recording what it was asked.
 */
export function fixtureSnapshotSource(snapshot: FixtureSnapshot) {
  let published = snapshot
  const exports: { routes: Route[], dates: { from: ParisDate, to: ParisDate } }[] = []

  const source: SnapshotSource = {
    async processedAt() {
      return published.processedAt
    },
    async trains(routes, dates) {
      exports.push({ routes: [...routes], dates })
      return published.trains.filter(train =>
        train.date >= dates.from && train.date <= dates.to
        && routes.some(route => route.originCode === train.originCode && route.destinationCode === train.destinationCode))
    },
  }

  return {
    source,
    /** Every export asked for, oldest first. */
    exports,
    publish(next: FixtureSnapshot) {
      published = next
    },
  }
}

/** Deletes every snapshot, and with them every train observation and opening. */
export async function clearSnapshots(): Promise<void> {
  const { error } = await admin.from('snapshots').delete().gte('id', 0)
  if (error) throw error
}

/** Every opening, with its train, in a stable order. */
export async function openings() {
  const { data, error } = await admin.from('openings')
    .select('is_open, first_snapshot_id, last_snapshot_id, train_observations (travel_date, train_number, origin_code, destination_code)')
    .order('id')
  if (error) throw error
  return data.map(({ train_observations: train, ...opening }) => ({ ...opening, train: `${train?.travel_date} ${train?.train_number} ${train?.origin_code}→${train?.destination_code}` }))
}

/** Every train observation, in a stable order. */
export async function observations() {
  const { data, error } = await admin.from('train_observations')
    .select('travel_date, train_number, origin_code, destination_code, departure_time, arrival_time, first_snapshot_id, last_snapshot_id')
    .order('travel_date').order('train_number').order('origin_code')
  if (error) throw error
  return data
}
