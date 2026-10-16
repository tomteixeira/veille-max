import type { Route } from '#shared/domain/trip-template'
import type { SnapshotSource, SnapshotTrain } from './snapshot-source'

// The SNCF `tgvmax` dataset on Opendatasoft, Explore API v2.1, no API key
// (docs/research/tgvmax-data-source.md). Rows come from the filtered export,
// which has no row cap, rather than from `/records` and its paging.
const DATASET_URL = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax'

/** A row of the `tgvmax` export, for the fields the app reads. */
interface ExportRow {
  date: string
  train_no: string
  origine_iata: string
  destination_iata: string
  heure_depart: string
  heure_arrivee: string
  od_happy_card: 'OUI' | 'NON'
}

const EXPORTED_FIELDS = ['date', 'train_no', 'origine_iata', 'destination_iata', 'heure_depart', 'heure_arrivee', 'od_happy_card']

/** The snapshot SNCF currently publishes, read through `fetch`. */
export function openDataSnapshotSource(fetch: typeof globalThis.fetch = globalThis.fetch): SnapshotSource {
  async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`SNCF open data answered ${response.status} to ${url}`)
    return await response.json() as T
  }

  return {
    async processedAt() {
      const dataset = await getJson<{ metas: { default: { data_processed: string } } }>(DATASET_URL)
      return new Date(dataset.metas.default.data_processed)
    },

    async trains(routes, dates) {
      if (routes.length === 0) return []

      const query = new URLSearchParams({
        select: EXPORTED_FIELDS.join(','),
        where: `date >= date'${checkedDate(dates.from)}' and date <= date'${checkedDate(dates.to)}' and (${routesFilter(routes)})`,
      })
      const rows = await getJson<ExportRow[]>(`${DATASET_URL}/exports/json?${query}`)
      return mergeDuplicates(rows.map(snapshotTrain))
    },
  }
}

/** `(origine_iata = 'A' and destination_iata in ('B', 'C')) or …`, one term per origin. */
function routesFilter(routes: readonly Route[]): string {
  const destinationsByOrigin = new Map<string, Set<string>>()
  for (const { originCode, destinationCode } of routes) {
    const destinations = destinationsByOrigin.get(checkedCode(originCode)) ?? new Set()
    destinations.add(checkedCode(destinationCode))
    destinationsByOrigin.set(originCode, destinations)
  }

  return [...destinationsByOrigin.keys()].sort().map((origin) => {
    const destinations = [...destinationsByOrigin.get(origin)!].sort().map(code => `'${code}'`).join(', ')
    return `(origine_iata = '${origin}' and destination_iata in (${destinations}))`
  }).join(' or ')
}

// Codes and dates are written into the query text: only well-formed ones get there.
function checkedCode(code: string): string {
  if (!/^[A-Z]{5}$/.test(code)) throw new Error(`Not a station code: ${code}`)
  return code
}

function checkedDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Not a date: ${date}`)
  return date
}

function snapshotTrain(row: ExportRow): SnapshotTrain {
  return {
    date: row.date,
    trainNumber: row.train_no,
    originCode: row.origine_iata,
    destinationCode: row.destination_iata,
    departureTime: row.heure_depart,
    arrivalTime: row.heure_arrivee,
    open: row.od_happy_card === 'OUI',
  }
}

/**
 * The dataset lists some trains several times on the same route and date,
 * often with conflicting availability: keeps one, open if any copy is.
 */
function mergeDuplicates(trains: SnapshotTrain[]): SnapshotTrain[] {
  const merged = new Map<string, SnapshotTrain>()
  for (const train of trains) {
    const key = [train.date, train.trainNumber, train.originCode, train.destinationCode].join(' ')
    const kept = merged.get(key)
    if (!kept) merged.set(key, train)
    else if (train.open) kept.open = true
  }
  return [...merged.values()]
}
