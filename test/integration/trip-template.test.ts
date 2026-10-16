import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultTripTemplate, type Route, type TemplateLeg, type TripTemplate } from '#shared/domain/trip-template'
import { loadStations, loadTripTemplate, saveTemplateLeg } from '#shared/utils/trip-template-store'
import { signedInTraveller, removeTraveller, signedOutClient, type Traveller } from './support/travellers'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisBercyToPartDieu: Route = { originCode: 'FRPBE', destinationCode: 'FRLPD' }
const partDieuToParisLyon: Route = { originCode: 'FRLPD', destinationCode: 'FRPLY' }
const partDieuToParisBercy: Route = { originCode: 'FRLPD', destinationCode: 'FRPBE' }
const perracheToParisLyon: Route = { originCode: 'FRLPE', destinationCode: 'FRPLY' }

// Postgres error codes.
const UNIQUE_VIOLATION = '23505'
const INSUFFICIENT_PRIVILEGE = '42501'

describe('trip template storage', () => {
  let traveller: Traveller

  beforeAll(async () => {
    traveller = await signedInTraveller()
  })

  afterAll(async () => {
    await removeTraveller(traveller)
  })

  it('gives a traveller who never saved their template the default one', async () => {
    expect(await loadTripTemplate(traveller.client, traveller.id)).toEqual(defaultTripTemplate())
  })

  it('names every station the traveller can pick, the city-level codes of the dataset included', async () => {
    const stations = await loadStations(traveller.client)

    expect(stations.length).toBeGreaterThanOrEqual(322)
    expect(stations).toContainEqual({ code: 'FRPLY', name: 'Paris Gare de Lyon' })
    expect(stations).toContainEqual({ code: 'FRLLE', name: 'Lille Europe' })
    expect(stations).toContainEqual({ code: 'FRMSC', name: 'Marseille St-Charles' })
  })

  it('keeps a saved leg: its weekday, time window, ideal time and ranked routes', async () => {
    const outbound: TemplateLeg = {
      weekday: 4,
      anchor: 'arrival',
      window: { start: '07:00', end: '10:30' },
      idealTime: '09:15',
      routes: [parisLyonToPartDieu, parisBercyToPartDieu],
    }

    await saveTemplateLeg(traveller.client, 'outbound', outbound)

    expect(await loadTripTemplate(traveller.client, traveller.id)).toEqual({ ...defaultTripTemplate(), outbound })
  })

  it('replaces the ranking of a leg on every save', async () => {
    const ret = defaultTripTemplate().return
    await saveTemplateLeg(traveller.client, 'return', { ...ret, routes: [partDieuToParisLyon, perracheToParisLyon, partDieuToParisBercy] })

    await saveTemplateLeg(traveller.client, 'return', { ...ret, routes: [partDieuToParisBercy, partDieuToParisLyon] })

    const { return: saved } = await loadTripTemplate(traveller.client, traveller.id)
    expect(saved.routes).toEqual([partDieuToParisBercy, partDieuToParisLyon])
  })

  it('refuses a leg that ranks the same route twice, and keeps the leg as it was', async () => {
    const before = await loadTripTemplate(traveller.client, traveller.id)

    await expect(saveTemplateLeg(traveller.client, 'return', {
      ...before.return,
      weekday: 1,
      routes: [partDieuToParisLyon, partDieuToParisLyon],
    })).rejects.toMatchObject({ code: UNIQUE_VIOLATION })

    expect(await loadTripTemplate(traveller.client, traveller.id)).toEqual(before)
  })
})

describe('trip template row-level security', () => {
  let owner: Traveller
  let other: Traveller
  let ownerTemplate: TripTemplate

  beforeAll(async () => {
    [owner, other] = await Promise.all([signedInTraveller(), signedInTraveller()])
    const { outbound } = defaultTripTemplate()
    await saveTemplateLeg(owner.client, 'outbound', { ...outbound, routes: [parisLyonToPartDieu] })
    ownerTemplate = await loadTripTemplate(owner.client, owner.id)
  })

  afterAll(async () => {
    await Promise.all([removeTraveller(owner), removeTraveller(other)])
  })

  it('stamps every template row with its traveller', async () => {
    const legs = await owner.client.from('template_legs').select('user_id')
    const routes = await owner.client.from('template_routes').select('user_id')

    expect(legs.data).toEqual([{ user_id: owner.id }])
    expect(routes.data).toEqual([{ user_id: owner.id }])
  })

  it('hides a traveller’s template from another traveller', async () => {
    expect(await loadTripTemplate(other.client, owner.id)).toEqual(defaultTripTemplate())
    expect((await other.client.from('template_legs').select()).data).toEqual([])
    expect((await other.client.from('template_routes').select()).data).toEqual([])
  })

  it('refuses rows another traveller writes in a traveller’s name', async () => {
    const leg = await other.client.from('template_legs')
      .insert({ user_id: owner.id, kind: 'return', weekday: 1, anchor: 'departure', ideal_time: '08:00' })
    const route = await other.client.from('template_routes')
      .insert({ user_id: owner.id, leg_kind: 'outbound', rank: 2, origin_code: 'FRPBE', destination_code: 'FRLPD' })

    expect(leg.error).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    expect(route.error).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    expect(await loadTripTemplate(owner.client, owner.id)).toEqual(ownerTemplate)
  })

  it('leaves a traveller’s template untouched when another traveller changes or removes it', async () => {
    await other.client.from('template_legs').update({ weekday: 1 }).eq('user_id', owner.id)
    await other.client.from('template_routes').update({ origin_code: 'FRPBE' }).eq('user_id', owner.id)
    await other.client.from('template_routes').delete().eq('user_id', owner.id)
    await other.client.from('template_legs').delete().eq('user_id', owner.id)

    expect(await loadTripTemplate(owner.client, owner.id)).toEqual(ownerTemplate)
  })

  it('saves a leg in the name of the signed-in traveller only', async () => {
    const otherOutbound: TemplateLeg = { ...defaultTripTemplate().outbound, weekday: 6, routes: [parisBercyToPartDieu] }

    await saveTemplateLeg(other.client, 'outbound', otherOutbound)

    expect(await loadTripTemplate(other.client, other.id)).toEqual({ ...defaultTripTemplate(), outbound: otherOutbound })
    expect(await loadTripTemplate(owner.client, owner.id)).toEqual(ownerTemplate)
  })

  it('keeps every template and station away from signed-out visitors', async () => {
    const visitor = signedOutClient()

    for (const table of ['template_legs', 'template_routes', 'stations'] as const) {
      const { data, error } = await visitor.from(table).select()
      expect(data, table).toBeNull()
      expect(error, table).toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    }
    await expect(saveTemplateLeg(visitor, 'outbound', defaultTripTemplate().outbound)).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
  })
})
