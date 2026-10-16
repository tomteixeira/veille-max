import { describe, expect, it } from 'vitest'
import { openDataSnapshotSource } from '../../server/snapshots/open-data-snapshot-source'

const DATASET = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax'

/** A row of the `tgvmax` export, as SNCF publishes it. */
function exportRow(row: { date: string, train_no: string, origine_iata: string, destination_iata: string, heure_depart: string, heure_arrivee: string, od_happy_card: 'OUI' | 'NON' }) {
  return { entity: 'PARISRHONE', axe: 'SUD EST', origine: 'PARIS (intramuros)', destination: 'LYON (intramuros)', ...row }
}

/** A `fetch` that answers from `responses` by URL path, and records every URL it is asked for. */
function fakeFetch(responses: Record<string, unknown>, status = 200) {
  const requested: URL[] = []
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requested.push(url)
    const body = responses[url.origin + url.pathname]
    if (body === undefined) return new Response('Not found', { status: 404 })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { fetch: fetch as typeof globalThis.fetch, requested }
}

describe('open-data snapshot source', () => {
  it('reads when SNCF took the published snapshot from the dataset metadata', async () => {
    const { fetch } = fakeFetch({ [DATASET]: { metas: { default: { data_processed: '2026-10-16T04:24:09+00:00' } } } })

    expect(await openDataSnapshotSource(fetch).processedAt()).toEqual(new Date('2026-10-16T04:24:09Z'))
  })

  it('exports only the requested routes over the requested days, through the filtered export', async () => {
    const { fetch, requested } = fakeFetch({ [`${DATASET}/exports/json`]: [] })

    await openDataSnapshotSource(fetch).trains(
      [
        { originCode: 'FRPLY', destinationCode: 'FRLPD' },
        { originCode: 'FRPLY', destinationCode: 'FRLPE' },
        { originCode: 'FRLPD', destinationCode: 'FRPLY' },
      ],
      { from: '2026-10-16', to: '2026-11-15' },
    )

    expect(requested).toHaveLength(1)
    expect(requested[0]?.searchParams.get('where')).toBe(
      'date >= date\'2026-10-16\' and date <= date\'2026-11-15\' and ('
      + '(origine_iata = \'FRLPD\' and destination_iata in (\'FRPLY\'))'
      + ' or (origine_iata = \'FRPLY\' and destination_iata in (\'FRLPD\', \'FRLPE\'))'
      + ')',
    )
  })

  it('gives every train of the export with its times and whether a seat is open', async () => {
    const { fetch } = fakeFetch({
      [`${DATASET}/exports/json`]: [
        exportRow({ date: '2026-10-23', train_no: '6603', origine_iata: 'FRPLY', destination_iata: 'FRLPD', heure_depart: '07:00', heure_arrivee: '08:56', od_happy_card: 'OUI' }),
        exportRow({ date: '2026-10-23', train_no: '6699', origine_iata: 'FRPLY', destination_iata: 'FRLPD', heure_depart: '23:10', heure_arrivee: '01:05', od_happy_card: 'NON' }),
      ],
    })

    const trains = await openDataSnapshotSource(fetch).trains([{ originCode: 'FRPLY', destinationCode: 'FRLPD' }], { from: '2026-10-16', to: '2026-11-15' })

    expect(trains).toEqual([
      { date: '2026-10-23', trainNumber: '6603', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '07:00', arrivalTime: '08:56', open: true },
      { date: '2026-10-23', trainNumber: '6699', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '23:10', arrivalTime: '01:05', open: false },
    ])
  })

  it('merges the duplicate rows of a train, open when any copy says OUI', async () => {
    const copy = { date: '2026-10-23', train_no: '6603', origine_iata: 'FRPLY', destination_iata: 'FRLPD', heure_depart: '07:00', heure_arrivee: '08:56' } as const
    const { fetch } = fakeFetch({
      [`${DATASET}/exports/json`]: [
        exportRow({ ...copy, od_happy_card: 'NON' }),
        exportRow({ ...copy, od_happy_card: 'OUI' }),
        exportRow({ ...copy, od_happy_card: 'NON' }),
        exportRow({ ...copy, train_no: '6605', od_happy_card: 'NON' }),
        exportRow({ ...copy, train_no: '6605', od_happy_card: 'NON' }),
      ],
    })

    const trains = await openDataSnapshotSource(fetch).trains([{ originCode: 'FRPLY', destinationCode: 'FRLPD' }], { from: '2026-10-16', to: '2026-11-15' })

    expect(trains.map(({ trainNumber, open }) => ({ trainNumber, open }))).toEqual([
      { trainNumber: '6603', open: true },
      { trainNumber: '6605', open: false },
    ])
  })

  it('asks nothing for no routes', async () => {
    const { fetch, requested } = fakeFetch({})

    expect(await openDataSnapshotSource(fetch).trains([], { from: '2026-10-16', to: '2026-11-15' })).toEqual([])
    expect(requested).toEqual([])
  })

  it('fails when SNCF does not answer', async () => {
    const { fetch } = fakeFetch({ [DATASET]: {}, [`${DATASET}/exports/json`]: [] }, 503)
    const source = openDataSnapshotSource(fetch)

    await expect(source.processedAt()).rejects.toThrow(/503/)
    await expect(source.trains([{ originCode: 'FRPLY', destinationCode: 'FRLPD' }], { from: '2026-10-16', to: '2026-11-15' })).rejects.toThrow(/503/)
  })
})
