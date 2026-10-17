import { addDays, daysBetween, type ParisDate } from '../utils/paris-time'
import { rankCandidates, TRACKING_HORIZON_DAYS, type BookedTrain, type Candidate, type Leg } from './evaluation'
import type { LegKind } from './trip-template'

// How a leg evolved day by day (spec, user story 62): its candidates in every
// snapshot of its booking window, replayed from the stored observations and
// openings, and ranked with the leg's current settings.

/** A leg whose history can be replayed: of a tracked trip, or of a trip archived since the first snapshot. */
export interface HistoryLeg {
  tripKey: string
  kind: LegKind
  date: ParisDate
  /** Whether the leg's date has passed: its history is complete. */
  past: boolean
}

/** An ingested snapshot, by the Paris day SNCF took it. */
export interface HistorySnapshot {
  id: number
  day: ParisDate
}

/** A train the snapshots listed, with the runs of snapshots in which it had an open seat (CONTEXT.md, Opening). */
export interface ObservedTrain extends BookedTrain {
  openings: { firstSnapshotId: number, lastSnapshotId: number }[]
}

/** A leg as one snapshot saw it. */
export interface LegHistoryColumn {
  snapshotId: number
  /** The Paris day the snapshot was taken. */
  day: ParisDate
  /** How many days before the leg's date the snapshot was taken. */
  daysBefore: number
  /** How many candidates the leg had in that snapshot. */
  candidates: number
  /** Its best candidate then, `null` when it had none. */
  best: Candidate | null
}

/**
 * One column per snapshot of the leg's booking window, from
 * `TRACKING_HORIZON_DAYS` days before its date to that date, oldest first. `snapshots` are every ingested snapshot, oldest first;
 * an opening covers every snapshot from its first to its last.
 */
export function legHistory(leg: Pick<Leg, 'date' | 'settings'>, routeWeight: number, snapshots: readonly HistorySnapshot[], trains: readonly ObservedTrain[]): LegHistoryColumn[] {
  const rankOf = new Map(snapshots.map(({ id }, rank) => [id, rank]))
  const windowStart = addDays(leg.date, -TRACKING_HORIZON_DAYS)

  const columns: LegHistoryColumn[] = []
  for (const [rank, { id, day }] of snapshots.entries()) {
    if (day < windowStart || day > leg.date) continue
    const observations = trains.map(({ openings, ...train }) => ({
      ...train,
      open: openings.some(opening => rankOf.get(opening.firstSnapshotId)! <= rank && rank <= rankOf.get(opening.lastSnapshotId)!),
    }))
    const candidates = rankCandidates(observations, leg.date, leg.settings, routeWeight)
    columns.push({ snapshotId: id, day, daysBefore: daysBetween(day, leg.date), candidates: candidates.length, best: candidates[0] ?? null })
  }
  return columns
}
