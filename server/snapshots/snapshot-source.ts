import type { LocalTime, Route } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'

/** One train of a snapshot: a train number on a route and a date, and whether it had an open MAX JEUNE seat. */
export interface SnapshotTrain {
  date: ParisDate
  trainNumber: string
  originCode: string
  destinationCode: string
  departureTime: LocalTime
  /** Earlier than the departure when the train arrives the next day. */
  arrivalTime: LocalTime
  open: boolean
}

/**
 * Where snapshots come from (spec, "Snapshot ingestion"): the SNCF open data
 * in production (`openDataSnapshotSource`), fixtures in tests.
 */
export interface SnapshotSource {
  /** When SNCF took the snapshot it currently publishes. */
  processedAt(): Promise<Date>
  /**
   * Every train the current snapshot lists on `routes`, from `dates.from` to
   * `dates.to` included, open or not: one per train, route and date.
   */
  trains(routes: readonly Route[], dates: { from: ParisDate, to: ParisDate }): Promise<SnapshotTrain[]>
}
