import { mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { TemplateLeg } from '../../../shared/domain/trip-template'
import type { Database } from '../../../shared/types/database.types'

/** The server role of the local stack, which bypasses RLS: for arranging and cleaning up. */
function admin() {
  return createClient<Database>(process.env.NUXT_PUBLIC_SUPABASE_URL!, process.env.NUXT_SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Saves a traveller's trip template straight to the database, without going through Réglages. */
export async function saveTripTemplate(travellerId: string, legs: { outbound: TemplateLeg, return: TemplateLeg }): Promise<void> {
  const db = admin()
  for (const kind of ['outbound', 'return'] as const) {
    const leg = legs[kind]
    const saved = await db.from('template_legs').insert({
      user_id: travellerId,
      kind,
      weekday: leg.weekday,
      anchor: leg.anchor,
      window_start: leg.window.start,
      window_end: leg.window.end,
      ideal_time: leg.idealTime,
    })
    expect(saved.error).toBeNull()
    const routes = await db.from('template_routes').insert(leg.routes.map((route, index) => ({
      user_id: travellerId,
      leg_kind: kind,
      rank: index + 1,
      origin_code: route.originCode,
      destination_code: route.destinationCode,
    })))
    expect(routes.error).toBeNull()
  }
}

/** A train a fixture snapshot lists. */
export interface FixtureTrain {
  date: string
  trainNumber: string
  originCode: string
  destinationCode: string
  departureTime: string
  arrivalTime: string
  open: boolean
}

/**
 * Records a snapshot taken now, listing `trains`, as the tick would ingest it:
 * it becomes the latest snapshot. Returns its id, for `removeSnapshot`.
 */
export async function recordSnapshot(trains: readonly FixtureTrain[]): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await admin().rpc('record_snapshot', {
    processed_at: now,
    ingested_at: now,
    trains: trains.map(train => ({
      date: train.date,
      train_number: train.trainNumber,
      origin_code: train.originCode,
      destination_code: train.destinationCode,
      departure_time: train.departureTime,
      arrival_time: train.arrivalTime,
      open: train.open,
    })),
  })
  expect(error).toBeNull()
  return (data as { snapshot_id: number }).snapshot_id
}

/** Deletes a snapshot, and with it the observations and openings it created. */
export async function removeSnapshot(snapshotId: number): Promise<void> {
  const { error } = await admin().from('snapshots').delete().eq('id', snapshotId)
  expect(error).toBeNull()
}

// Every traveller reads the latest snapshot: tests that record one take turns,
// across Playwright workers, through a lock directory.
const LATEST_SNAPSHOT_LOCK = join(tmpdir(), 'veille-max-e2e-latest-snapshot.lock')
// A lock older than this was left by a run that crashed.
const STALE_LOCK_MS = 5 * 60_000

async function lockLatestSnapshot(): Promise<void> {
  for (;;) {
    try {
      await mkdir(LATEST_SNAPSHOT_LOCK)
      return
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const lockedAt = await stat(LATEST_SNAPSHOT_LOCK).then(({ mtimeMs }) => mtimeMs, () => Date.now())
      if (Date.now() - lockedAt > STALE_LOCK_MS) await rm(LATEST_SNAPSHOT_LOCK, { recursive: true, force: true })
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
}

/**
 * Runs `body` while a snapshot listing `trains` is the latest one, then
 * deletes it. No other test records a snapshot meanwhile.
 */
export async function withLatestSnapshot(trains: readonly FixtureTrain[], body: () => Promise<void>): Promise<void> {
  await lockLatestSnapshot()
  try {
    const snapshotId = await recordSnapshot(trains)
    try {
      await body()
    }
    finally {
      await removeSnapshot(snapshotId)
    }
  }
  finally {
    await rm(LATEST_SNAPSHOT_LOCK, { recursive: true, force: true })
  }
}

/** Declares a traveller's booking straight in the database, without going through the leg view. The train must be one a snapshot listed. */
export async function saveBooking(travellerId: string, booking: { tripKey: string, legKind: 'outbound' | 'return', train: FixtureTrain }): Promise<void> {
  const { train } = booking
  const { error } = await admin().from('bookings').insert({
    user_id: travellerId,
    trip_key: booking.tripKey,
    leg_kind: booking.legKind,
    travel_date: train.date,
    train_number: train.trainNumber,
    origin_code: train.originCode,
    destination_code: train.destinationCode,
  })
  expect(error).toBeNull()
}
