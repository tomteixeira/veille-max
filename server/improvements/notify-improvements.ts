import type { SupabaseClient } from '@supabase/supabase-js'
import type { Improvement } from '#shared/domain/evaluation'
import { saveLegReferences } from '#shared/utils/leg-reference-store'
import { loadLastSnapshot } from '#shared/utils/snapshot-store'
import type { Database } from '#shared/types/database.types'
import type { NotificationResult } from '#shared/types/push'
import { evaluateTraveller } from '../evaluation/traveller-evaluation'
import { notifyTraveller } from '../push/notify-traveller'
import type { PushGateway } from '../push/push-gateway'
import { improvementMessage } from './improvement-message'

// Postgres error code.
const UNIQUE_VIOLATION = '23505'

export interface ImprovementsDependencies {
  /** A server-role client. */
  db: SupabaseClient<Database>
  gateway: PushGateway
  /** The current instant. */
  now: Date
}

/** What evaluating a snapshot did: how many travellers it evaluated, how many improvements it notified, and to how many devices. */
export interface ImprovementsSummary extends NotificationResult {
  snapshotId: number
  travellers: number
  improvements: number
}

/**
 * Evaluates every traveller against the latest snapshot, unless it was
 * already evaluated (spec, "Tick endpoint"): notifies each leg whose best
 * candidate improved, then stores every leg's new reference, muted or not.
 * A traveller's first evaluation only stores their references, so that the
 * first deploy, or a first snapshot, does not notify every train they can
 * already see. Returns `null` when there was nothing to evaluate.
 *
 * Each improvement is logged before it is sent, once per leg and snapshot: a
 * run that stopped half-way can run again without sending anything twice.
 */
export async function notifyImprovements({ db, gateway, now }: ImprovementsDependencies): Promise<ImprovementsSummary | null> {
  const snapshot = await loadLastSnapshot(db)
  if (!snapshot) return null
  const { data: stamp, error } = await db.from('snapshots').select('evaluated_at').eq('id', snapshot.id).single()
  if (error) throw error
  if (stamp.evaluated_at !== null) return null

  const summary: ImprovementsSummary = { snapshotId: snapshot.id, travellers: 0, improvements: 0, delivered: 0, gone: 0, failed: 0 }
  for (const travellerId of await travellerIds(db)) {
    const evaluation = await evaluateTraveller(db, travellerId, now)
    // A snapshot ingested since: the next tick evaluates it.
    if (evaluation.snapshotId !== snapshot.id) return summary
    const stationName = (code: string) => evaluation.stationNames[code] ?? code

    for (const improvement of evaluation.evaluatedBefore ? evaluation.improvements : []) {
      if (!await logImprovement(db, travellerId, snapshot.id, improvement)) continue
      const result = await notifyTraveller(db, gateway, travellerId, improvementMessage(improvement, stationName))
      summary.improvements += 1
      summary.delivered += result.delivered
      summary.gone += result.gone
      summary.failed += result.failed
    }
    await saveLegReferences(db, travellerId, snapshot.id, evaluation.references)
    summary.travellers += 1
  }

  const { error: stampError } = await db.from('snapshots').update({ evaluated_at: now.toISOString() }).eq('id', snapshot.id)
  if (stampError) throw stampError
  return summary
}

/** Every traveller with a trip template or a customised trip: those who may have routes to evaluate. */
async function travellerIds(db: SupabaseClient<Database>): Promise<string[]> {
  const [template, customised] = await Promise.all([
    db.from('template_legs').select('user_id'),
    db.from('customised_trip_legs').select('user_id'),
  ])
  if (template.error) throw template.error
  if (customised.error) throw customised.error
  return [...new Set([...template.data, ...customised.data].map(row => row.user_id))]
}

/** Logs an improvement of `travellerId`. `false` when it was already logged: it was sent. */
async function logImprovement(db: SupabaseClient<Database>, travellerId: string, snapshotId: number, { tripKey, legKind, kind, candidate: { train } }: Improvement): Promise<boolean> {
  const { error } = await db.from('notification_log').insert({
    user_id: travellerId,
    kind: 'improvement',
    trip_key: tripKey,
    leg_kind: legKind,
    snapshot_id: snapshotId,
    improvement_kind: kind,
    travel_date: train.date,
    train_number: train.trainNumber,
    origin_code: train.originCode,
    destination_code: train.destinationCode,
    departure_time: train.departureTime,
    arrival_time: train.arrivalTime,
  })
  if (error?.code === UNIQUE_VIOLATION) return false
  if (error) throw error
  return true
}
