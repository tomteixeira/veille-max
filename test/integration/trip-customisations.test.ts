import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TripCustomisation } from '#shared/domain/evaluation'
import type { Route } from '#shared/domain/trip-template'
import { loadCustomisations, loadMutes, resetTrip, saveCustomisedTrip, setMute } from '#shared/utils/trip-store'
import { removeTraveller, signedInTraveller, signedOutClient, type Traveller } from './support/travellers'

const parisLyonToMarseille: Route = { originCode: 'FRPLY', destinationCode: 'FRMSC' }
const parisLyonToNice: Route = { originCode: 'FRPLY', destinationCode: 'FRNIC' }
const marseilleToParisLyon: Route = { originCode: 'FRMSC', destinationCode: 'FRPLY' }

// Postgres error codes.
const UNIQUE_VIOLATION = '23505'
const INSUFFICIENT_PRIVILEGE = '42501'

/** Week 43 to Marseille: out on Thursday 22 October in the evening, back on Sunday 25. */
const toMarseille: TripCustomisation = {
  outbound: { date: '2026-10-22', anchor: 'departure', window: { start: '18:00', end: null }, idealTime: '19:00', routes: [parisLyonToMarseille, parisLyonToNice] },
  return: { date: '2026-10-25', anchor: 'departure', window: { start: '14:00', end: '20:00' }, idealTime: '17:00', routes: [marseilleToParisLyon] },
}

describe('trip customisation storage', () => {
  let traveller: Traveller

  beforeAll(async () => {
    traveller = await signedInTraveller()
  })

  afterAll(async () => {
    await removeTraveller(traveller)
  })

  it('has no customised trip and no mute for a new traveller', async () => {
    expect(await loadCustomisations(traveller.client, traveller.id)).toEqual({})
    expect(await loadMutes(traveller.client, traveller.id)).toEqual([])
  })

  it('keeps a customised trip: both legs’ dates, windows, ideal times and ranked routes', async () => {
    await saveCustomisedTrip(traveller.client, '2026-W43', toMarseille)

    expect(await loadCustomisations(traveller.client, traveller.id)).toEqual({ '2026-W43': toMarseille })
  })

  it('replaces a customised trip on every save', async () => {
    const backOnMonday = { ...toMarseille, return: { ...toMarseille.return, date: '2026-10-26', routes: [marseilleToParisLyon] } }
    const toNiceOnly = { ...backOnMonday, outbound: { ...backOnMonday.outbound, routes: [parisLyonToNice] } }

    await saveCustomisedTrip(traveller.client, '2026-W43', backOnMonday)
    await saveCustomisedTrip(traveller.client, '2026-W43', toNiceOnly)

    expect(await loadCustomisations(traveller.client, traveller.id)).toEqual({ '2026-W43': toNiceOnly })
  })

  it('refuses a customised leg that ranks the same route twice, and keeps the trip as it was', async () => {
    const before = await loadCustomisations(traveller.client, traveller.id)

    await expect(saveCustomisedTrip(traveller.client, '2026-W43', {
      ...toMarseille,
      outbound: { ...toMarseille.outbound, routes: [parisLyonToMarseille, parisLyonToMarseille] },
    })).rejects.toMatchObject({ code: UNIQUE_VIOLATION })

    expect(await loadCustomisations(traveller.client, traveller.id)).toEqual(before)
  })

  it('forgets a trip’s customisation when it is reset, and only that trip’s', async () => {
    await saveCustomisedTrip(traveller.client, '2026-W44', { ...toMarseille, outbound: { ...toMarseille.outbound, date: '2026-10-29' } })

    await resetTrip(traveller.client, '2026-W43')

    expect(Object.keys(await loadCustomisations(traveller.client, traveller.id))).toEqual(['2026-W44'])
  })

  it('mutes and unmutes a whole trip and a single leg', async () => {
    await setMute(traveller.client, { tripKey: '2026-W45' }, true)
    await setMute(traveller.client, { tripKey: '2026-W46', leg: 'return' }, true)
    // Muting twice changes nothing.
    await setMute(traveller.client, { tripKey: '2026-W45' }, true)

    expect(await loadMutes(traveller.client, traveller.id)).toEqual(expect.arrayContaining([{ tripKey: '2026-W45' }, { tripKey: '2026-W46', leg: 'return' }]))
    expect(await loadMutes(traveller.client, traveller.id)).toHaveLength(2)

    await setMute(traveller.client, { tripKey: '2026-W45' }, false)
    await setMute(traveller.client, { tripKey: '2026-W46', leg: 'outbound' }, false)

    expect(await loadMutes(traveller.client, traveller.id)).toEqual([{ tripKey: '2026-W46', leg: 'return' }])
  })
})

describe('trip customisation row-level security', () => {
  let owner: Traveller
  let other: Traveller

  beforeAll(async () => {
    [owner, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
    await saveCustomisedTrip(owner.client, '2026-W43', toMarseille)
    await setMute(owner.client, { tripKey: '2026-W43', leg: 'outbound' }, true)
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(owner), removeTraveller(other)])
  })

  it('stamps every customisation and mute with its traveller', async () => {
    for (const table of ['customised_trip_legs', 'customised_trip_routes', 'mutes'] as const) {
      const { data } = await owner.client.from(table).select('user_id')
      expect(new Set(data?.map(row => row.user_id)), table).toEqual(new Set([owner.id]))
    }
  })

  it('hides a traveller’s customisations and mutes from another traveller', async () => {
    expect(await loadCustomisations(other.client, owner.id)).toEqual({})
    expect(await loadMutes(other.client, owner.id)).toEqual([])
  })

  it('leaves a traveller’s customisations and mutes untouched when another traveller writes, resets or unmutes them', async () => {
    const leg = await other.client.from('customised_trip_legs')
      .insert({ user_id: owner.id, trip_key: '2026-W44', kind: 'outbound', travel_date: '2026-10-30', anchor: 'arrival', ideal_time: '09:00' })
    const mute = await other.client.from('mutes').insert({ user_id: owner.id, trip_key: '2026-W44' })
    await other.client.from('customised_trip_legs').update({ travel_date: '2026-10-21' }).eq('user_id', owner.id)
    await other.client.from('customised_trip_legs').delete().eq('user_id', owner.id)
    await other.client.from('mutes').delete().eq('user_id', owner.id)

    expect(leg.error).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    expect(mute.error).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    expect(await loadCustomisations(owner.client, owner.id)).toEqual({ '2026-W43': toMarseille })
    expect(await loadMutes(owner.client, owner.id)).toEqual([{ tripKey: '2026-W43', leg: 'outbound' }])
  })

  it('saves a customised trip in the name of the signed-in traveller only', async () => {
    await saveCustomisedTrip(other.client, '2026-W43', { ...toMarseille, outbound: { ...toMarseille.outbound, routes: [parisLyonToNice] } })

    expect(await loadCustomisations(owner.client, owner.id)).toEqual({ '2026-W43': toMarseille })
  })

  it('keeps every customisation and mute away from signed-out visitors', async () => {
    const visitor = signedOutClient()

    for (const table of ['customised_trip_legs', 'customised_trip_routes', 'mutes'] as const) {
      const { data, error } = await visitor.from(table).select()
      expect(data, table).toBeNull()
      expect(error, table).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    }
    await expect(saveCustomisedTrip(visitor, '2026-W43', toMarseille)).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
  })
})
