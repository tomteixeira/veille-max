import { describe, expect, it } from 'vitest'
import { legHistory, type ObservedTrain } from '#shared/domain/leg-history'
import { defaultTripTemplate, type LegSettings, type Route } from '#shared/domain/trip-template'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const montparnasseToBordeaux: Route = { originCode: 'FRPMO', destinationCode: 'FRBOJ' }

// The outbound leg of Friday 23 October 2026: arrive before 10:00, ideally at 09:00, Part-Dieu first.
const { anchor, window, idealTime } = defaultTripTemplate().outbound
const settings: LegSettings = { anchor, window, idealTime, routes: [parisLyonToPartDieu, parisLyonToPerrache] }
const leg = { date: '2026-10-23', settings }

// Five morning snapshots, Saturday 17 to Wednesday 21 October.
const snapshots = [
  { id: 11, day: '2026-10-17' },
  { id: 12, day: '2026-10-18' },
  { id: 13, day: '2026-10-19' },
  { id: 14, day: '2026-10-20' },
  { id: 15, day: '2026-10-21' },
]

function train(trainNumber: string, route: Route, departureTime: string, arrivalTime: string, openings: [number, number][], date = '2026-10-23'): ObservedTrain {
  return { date, trainNumber, ...route, departureTime, arrivalTime, openings: openings.map(([firstSnapshotId, lastSnapshotId]) => ({ firstSnapshotId, lastSnapshotId })) }
}

describe('leg history', () => {
  it('gives one column per snapshot, with the number of candidates and the best one in each', () => {
    const trains = [
      // Out of the window, open from the 17th to the 20th.
      train('6641', parisLyonToPartDieu, '10:00', '11:56', [[11, 14]]),
      // Right on the ideal time, open on the 18th, then again from the 20th.
      train('6603', parisLyonToPartDieu, '07:04', '09:00', [[12, 12], [14, 15]]),
      // In the window on route 2, open on the 19th only.
      train('6611', parisLyonToPerrache, '07:10', '09:06', [[13, 13]]),
    ]

    const columns = legHistory(leg, 30, snapshots, trains)

    expect(columns.map(({ snapshotId, day, daysBefore, candidates, best }) => [snapshotId, day, daysBefore, candidates, best?.train.trainNumber ?? null])).toEqual([
      [11, '2026-10-17', 6, 1, '6641'],
      [12, '2026-10-18', 5, 2, '6603'],
      [13, '2026-10-19', 4, 2, '6611'],
      [14, '2026-10-20', 3, 2, '6603'],
      [15, '2026-10-21', 2, 1, '6603'],
    ])
  })

  it('ranks each snapshot’s candidates with the leg’s settings and the route weight', () => {
    // Both out of the window: 60 minutes on route 1, against 25 minutes on route 2.
    const trains = [
      train('6651', parisLyonToPartDieu, '09:04', '11:00', [[11, 11]]),
      train('6621', parisLyonToPerrache, '08:29', '10:25', [[11, 11]]),
    ]

    const [weighted30] = legHistory(leg, 30, snapshots, trains)
    const [weighted60] = legHistory(leg, 60, snapshots, trains)

    expect(weighted30?.best).toMatchObject({ train: { trainNumber: '6621' }, routeRank: 2, inWindow: false, minutesOutsideWindow: 25 })
    expect(weighted60?.best?.train.trainNumber).toBe('6651')
  })

  it('leaves out the trains of other routes and other days', () => {
    const trains = [
      train('8501', montparnasseToBordeaux, '07:52', '09:58', [[11, 15]]),
      train('6603', parisLyonToPartDieu, '07:04', '09:00', [[11, 15]], '2026-10-24'),
    ]

    const columns = legHistory(leg, 30, snapshots, trains)

    expect(columns.map(column => [column.candidates, column.best])).toEqual(Array.from({ length: 5 }, () => [0, null]))
  })

  it('only counts the snapshots of the leg’s booking window, from 30 days before its date to its date', () => {
    const longAgo = [{ id: 1, day: '2026-09-22' }, { id: 2, day: '2026-09-23' }]
    const after = [{ id: 20, day: '2026-10-23' }, { id: 21, day: '2026-10-24' }]

    const columns = legHistory(leg, 30, [...longAgo, ...snapshots, ...after], [])

    expect(columns.map(column => column.daysBefore)).toEqual([30, 6, 5, 4, 3, 2, 0])
  })

  it('is empty before the first snapshot', () => {
    expect(legHistory(leg, 30, [], [])).toEqual([])
  })
})
