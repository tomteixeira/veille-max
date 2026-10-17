import { TRACKING_HORIZON_DAYS } from './evaluation'
import type { Weekday } from './trip-template'

// When MAX JEUNE seats come out on a traveller's routes (spec, user stories 59
// to 61 and 63): the dashboard's charts, from the openings and observations of
// every ingested snapshot, grouped by the weekday of the trains' travel date.

/** The availability history of a traveller's routes, grouped as the database counts it. */
export interface OpeningHistory {
  /** Openings that started `daysBefore` days before departure. */
  starts: { weekday: Weekday, daysBefore: number, openings: number }[]
  /** Train-mornings (a train listed by one snapshot) departing at `hour`, and how many of them had an open seat. */
  slots: { weekday: Weekday, hour: number, listed: number, open: number }[]
  /** Openings that ended with their seat taken, lasting `days` days from their first to their last snapshot. */
  lifetimes: { weekday: Weekday, days: number, openings: number }[]
}

/** The travel weekdays the dashboard counts: some, or all of them. */
export type WeekdayFilter = readonly Weekday[] | 'all'

export interface OpeningCurve {
  /** One column per day before departure, from D-30 to D-0. */
  columns: { daysBefore: number, openings: number }[]
  /** The waves: the days before departure of up to three peaks, earliest first. */
  peaks: number[]
  total: number
}

/** A departure-hour band, from `fromHour` included to `toHour` excluded. */
export interface HourBand {
  fromHour: number
  toHour: number
}

export const HOUR_BANDS: readonly HourBand[] = [
  { fromHour: 0, toHour: 8 },
  { fromHour: 8, toHour: 11 },
  { fromHour: 11, toHour: 14 },
  { fromHour: 14, toHour: 17 },
  { fromHour: 17, toHour: 20 },
  { fromHour: 20, toHour: 24 },
]

export interface SlotGrid {
  bands: readonly HourBand[]
  /** One row per weekday, Monday first: per band, the percentage of train-mornings with an open seat, `null` without any. */
  rows: { weekday: Weekday, percents: (number | null)[] }[]
  /** The slot with the highest percentage, `null` without any train. */
  best: { weekday: Weekday, bandIndex: number, percent: number } | null
}

/** A range of opening lifetimes, in days; `toDays` is `null` for the open-ended last one. */
export interface LifetimeBucket {
  fromDays: number
  toDays: number | null
  openings: number
  /** Share of the openings, in whole percents adding up to 100. */
  percent: number
}

export interface LifetimeSpread {
  buckets: LifetimeBucket[]
  total: number
}

export interface OpeningDashboard {
  curve: OpeningCurve
  slots: SlotGrid
  lifetimes: LifetimeSpread
}

const LIFETIME_RANGES: readonly { fromDays: number, toDays: number | null }[] = [
  { fromDays: 0, toDays: 0 },
  { fromDays: 1, toDays: 1 },
  { fromDays: 2, toDays: 2 },
  { fromDays: 3, toDays: 6 },
  { fromDays: 7, toDays: null },
]

const ALL_WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7]

const MAX_PEAKS = 3
// A peak lower than this share of the highest column is noise, not a wave.
const PEAK_THRESHOLD = 1 / 4

/** The dashboard's charts for the trains travelling on `weekdays`. */
export function openingDashboard(history: OpeningHistory, weekdays: WeekdayFilter): OpeningDashboard {
  const kept = weekdays === 'all' ? ALL_WEEKDAYS : ALL_WEEKDAYS.filter(weekday => weekdays.includes(weekday))
  const counted = ({ weekday }: { weekday: Weekday }) => kept.includes(weekday)

  return {
    curve: openingCurve(history.starts.filter(counted)),
    slots: slotGrid(history.slots.filter(counted), kept),
    lifetimes: lifetimeSpread(history.lifetimes.filter(counted)),
  }
}

function openingCurve(starts: OpeningHistory['starts']): OpeningCurve {
  const columns = Array.from({ length: TRACKING_HORIZON_DAYS + 1 }, (_, index) => ({ daysBefore: TRACKING_HORIZON_DAYS - index, openings: 0 }))
  for (const { daysBefore, openings } of starts) {
    const column = columns[TRACKING_HORIZON_DAYS - daysBefore]
    if (column) column.openings += openings
  }
  return {
    columns,
    peaks: peaks(columns.map(column => column.openings)).map(index => columns[index]!.daysBefore),
    total: columns.reduce((sum, column) => sum + column.openings, 0),
  }
}

/** The indexes of up to three local maxima, highest first among them, returned in index order. */
function peaks(values: readonly number[]): number[] {
  const highest = Math.max(0, ...values)
  if (highest === 0) return []

  const maxima: number[] = []
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!
    // A plateau peaks on its first column: equal to the left would have peaked already.
    const left = index === 0 ? -Infinity : values[index - 1]!
    let right = index + 1
    while (right < values.length && values[right] === value) right++
    const next = right === values.length ? -Infinity : values[right]!
    if (value > left && value > next && value >= highest * PEAK_THRESHOLD) maxima.push(index)
  }

  return maxima
    .sort((a, b) => values[b]! - values[a]! || a - b)
    .slice(0, MAX_PEAKS)
    .sort((a, b) => a - b)
}

function slotGrid(slots: OpeningHistory['slots'], weekdays: readonly Weekday[]): SlotGrid {
  let best: SlotGrid['best'] = null
  const rows = weekdays.map((weekday) => {
    const percents = HOUR_BANDS.map((band, bandIndex) => {
      const inBand = slots.filter(slot => slot.weekday === weekday && slot.hour >= band.fromHour && slot.hour < band.toHour)
      const listed = inBand.reduce((sum, slot) => sum + slot.listed, 0)
      if (listed === 0) return null
      const percent = Math.round(100 * inBand.reduce((sum, slot) => sum + slot.open, 0) / listed)
      if (!best || percent > best.percent) best = { weekday, bandIndex, percent }
      return percent
    })
    return { weekday, percents }
  })
  return { bands: HOUR_BANDS, rows, best }
}

function lifetimeSpread(lifetimes: OpeningHistory['lifetimes']): LifetimeSpread {
  const counts = LIFETIME_RANGES.map(range => lifetimes
    .filter(({ days }) => days >= range.fromDays && (range.toDays === null || days <= range.toDays))
    .reduce((sum, lifetime) => sum + lifetime.openings, 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const percents = wholePercents(counts, total)
  return {
    buckets: LIFETIME_RANGES.map((range, index) => ({ ...range, openings: counts[index]!, percent: percents[index]! })),
    total,
  }
}

/** `counts` as whole percents of `total` adding up to 100 (largest remainder), all 0 when `total` is. */
function wholePercents(counts: readonly number[], total: number): number[] {
  if (total === 0) return counts.map(() => 0)
  const exact = counts.map(count => 100 * count / total)
  const percents = exact.map(Math.floor)
  let missing = 100 - percents.reduce((sum, percent) => sum + percent, 0)
  const byRemainder = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (missing-- <= 0) break
    percents[index]! += 1
  }
  return percents
}
