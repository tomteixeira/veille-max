import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { bookingsToConfirm } from '#shared/domain/confirmation-reminder'
import type { Booking } from '#shared/domain/evaluation'
import { loadBookings } from '#shared/utils/booking-store'
import type { Database } from '#shared/types/database.types'

/** « Trajets à confirmer »: the legs to confirm today, and the full name of their stations. */
export interface ConfirmationList {
  /** The signed-in traveller's bookings of trains leaving tomorrow, in departure order. */
  bookings: Booking[]
  stationNames: Record<string, string>
}

/** The legs the signed-in traveller booked for tomorrow, to confirm on MAX JEUNE before 17:00 today. */
export default defineEventHandler(async (event): Promise<ConfirmationList> => {
  const traveller = await serverSupabaseUser(event)
  if (!traveller) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const client = await serverSupabaseClient<Database>(event)
  const bookings = bookingsToConfirm(new Date(), await loadBookings(client, traveller.sub))
  const codes = [...new Set(bookings.flatMap(({ train }) => [train.originCode, train.destinationCode]))]
  if (codes.length === 0) return { bookings, stationNames: {} }

  const { data, error } = await client.from('stations').select('code, name').in('code', codes)
  if (error) throw error
  return { bookings, stationNames: Object.fromEntries(data.map(station => [station.code, station.name])) }
})
