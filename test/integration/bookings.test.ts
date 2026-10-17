import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Booking, BookedTrain } from '#shared/domain/evaluation'
import { cancelBooking, loadBookings, saveBooking } from '#shared/utils/booking-store'
import { admin, removeTraveller, signedInTraveller, signedOutClient, type Traveller } from './support/travellers'

// Postgres error codes.
const FOREIGN_KEY_VIOLATION = '23503'
const INSUFFICIENT_PRIVILEGE = '42501'

const morningTrain: BookedTrain = { date: '2026-11-06', trainNumber: '6611', originCode: 'FRPLY', destinationCode: 'FRLPE', departureTime: '07:10', arrivalTime: '09:06' }
const earlyTrain: BookedTrain = { date: '2026-11-06', trainNumber: '6601', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '06:05', arrivalTime: '08:01' }
const sundayTrain: BookedTrain = { date: '2026-11-08', trainNumber: '6680', originCode: 'FRLPD', destinationCode: 'FRPLY', departureTime: '17:04', arrivalTime: '19:00' }

function booking(legKind: 'outbound' | 'return', train: BookedTrain): Booking {
  return { tripKey: '2026-W45', legKind, train }
}

/** A booking as it is loaded back: with when it was declared. */
function declared(legKind: 'outbound' | 'return', train: BookedTrain) {
  return { ...booking(legKind, train), declaredAt: expect.any(Date) }
}

describe('booking storage', () => {
  let traveller: Traveller
  let other: Traveller
  let snapshotId: number

  beforeAll(async () => {
    [traveller, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
    // A snapshot of its own, listing the booked trains: the morning train shows no seat any more.
    const processedAt = new Date(Date.UTC(2000, 0, 1, 0, 0, Math.floor(Math.random() * 1e9))).toISOString()
    const { data, error } = await admin.rpc('record_snapshot', {
      processed_at: processedAt,
      ingested_at: processedAt,
      trains: [morningTrain, earlyTrain, sundayTrain].map(train => ({
        date: train.date,
        train_number: train.trainNumber,
        origin_code: train.originCode,
        destination_code: train.destinationCode,
        departure_time: train.departureTime,
        arrival_time: train.arrivalTime,
        open: train !== morningTrain,
      })),
    })
    if (error) throw error
    snapshotId = (data as { snapshot_id: number }).snapshot_id
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(traveller), removeTraveller(other)])
    await admin.from('snapshots').delete().eq('id', snapshotId)
  })

  it('keeps a declared booking with the booked train’s times, whether or not it still shows a seat', async () => {
    await saveBooking(traveller.client, traveller.id, booking('outbound', morningTrain))

    expect(await loadBookings(traveller.client, traveller.id)).toEqual([declared('outbound', morningTrain)])
  })

  it('holds at most one booking per leg: declaring a new one replaces it', async () => {
    await saveBooking(traveller.client, traveller.id, booking('outbound', earlyTrain))
    await saveBooking(traveller.client, traveller.id, booking('return', sundayTrain))

    expect(await loadBookings(traveller.client, traveller.id)).toEqual([declared('outbound', earlyTrain), declared('return', sundayTrain)])
  })

  it('dates a booking from when it was last declared', async () => {
    const before = Date.now()
    await saveBooking(traveller.client, traveller.id, booking('return', sundayTrain))

    const [, sunday] = await loadBookings(traveller.client, traveller.id)
    // Within a few seconds, whatever the clocks of the test runner and the database.
    expect(Math.abs(sunday!.declaredAt.getTime() - before)).toBeLessThan(5_000)
  })

  it('cancels the booking of one leg', async () => {
    await cancelBooking(traveller.client, traveller.id, '2026-W45', 'outbound')

    expect(await loadBookings(traveller.client, traveller.id)).toEqual([declared('return', sundayTrain)])
  })

  it('refuses a train the snapshots never listed', async () => {
    const unknownTrain = { ...earlyTrain, trainNumber: '0000' }

    await expect(saveBooking(traveller.client, traveller.id, booking('outbound', unknownTrain))).rejects.toMatchObject({ code: FOREIGN_KEY_VIOLATION })
  })

  it('never shows nor lets another traveller change a traveller’s bookings', async () => {
    expect(await loadBookings(other.client, traveller.id)).toEqual([])
    await expect(saveBooking(other.client, traveller.id, booking('outbound', earlyTrain))).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    await cancelBooking(other.client, traveller.id, '2026-W45', 'return')

    expect(await loadBookings(traveller.client, traveller.id)).toEqual([declared('return', sundayTrain)])
  })

  it('refuses a signed-out visitor', async () => {
    await expect(saveBooking(signedOutClient(), traveller.id, booking('outbound', earlyTrain))).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
  })
})
