import type { Station } from '#shared/domain/trip-template'

/** How many matching stations the picker lists at most. */
const MAX_RESULTS = 6

/**
 * Words of a station name or of a query, as compared: no case, no accents, no
 * punctuation, and « saint(e) » written « st(e) » as station names often are
 * (« Marseille St-Charles »).
 */
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(word => (word === 'saint' ? 'st' : word === 'sainte' ? 'ste' : word))
}

/**
 * The stations whose name has a word starting with each word of `query`
 * (« part dieu », « st exup »), names starting with the query first.
 * `stations` are expected in name order, which the result keeps otherwise.
 */
export function searchStations(stations: readonly Station[], query: string): Station[] {
  const wanted = words(query)
  if (wanted.length === 0) return []

  const matches = stations
    .map(station => ({ station, words: words(station.name) }))
    .filter(({ words }) => wanted.every(word => words.some(nameWord => nameWord.startsWith(word))))
  const startsWithQuery = ({ words }: { words: string[] }) => words[0]!.startsWith(wanted[0]!)

  return [...matches.filter(startsWithQuery), ...matches.filter(match => !startsWithQuery(match))]
    .slice(0, MAX_RESULTS)
    .map(({ station }) => station)
}
