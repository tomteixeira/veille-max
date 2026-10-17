import type { SupabaseClient } from '@supabase/supabase-js'
import { openingDashboard, type OpeningDashboard } from '#shared/domain/opening-history'
import { sameRoute } from '#shared/domain/evaluation'
import { LEG_KINDS, type Route, type Weekday } from '#shared/domain/trip-template'
import { loadOpeningHistory } from '#shared/utils/opening-history-store'
import { loadTripTemplate } from '#shared/utils/trip-template-store'
import type { Database } from '#shared/types/database.types'

/** The travel days the dashboard counts: the trip template's weekdays, or every day. */
export type DashboardFilter = 'trip' | 'all'

export function isDashboardFilter(value: unknown): value is DashboardFilter {
  return value === 'trip' || value === 'all'
}

/** What the dashboard shows (spec, "Evaluation read API"): when seats come out on the traveller's routes. */
export interface DashboardView extends OpeningDashboard {
  /** When SNCF took the first ingested snapshot, as an ISO instant: the start of the history, `null` before it. */
  since: string | null
  /** The weekdays of the traveller's trip template, outbound first, without duplicates. */
  tripWeekdays: Weekday[]
  filter: DashboardFilter
  /** Whether the traveller's trip template has any route to count. */
  hasRoutes: boolean
}

/** The dashboard of `travellerId`: the history of their template routes, on the travel days of `filter`. */
export async function loadDashboard(client: SupabaseClient<Database>, travellerId: string, filter: DashboardFilter): Promise<DashboardView> {
  const template = await loadTripTemplate(client, travellerId)
  const routes: Route[] = []
  for (const kind of LEG_KINDS) {
    for (const route of template[kind].routes) {
      if (!routes.some(known => sameRoute(known, route))) routes.push(route)
    }
  }
  const tripWeekdays = [...new Set(LEG_KINDS.map(kind => template[kind].weekday))]

  const { firstSnapshotAt, history } = await loadOpeningHistory(client, routes)
  return {
    ...openingDashboard(history, filter === 'trip' ? tripWeekdays : 'all'),
    since: firstSnapshotAt?.toISOString() ?? null,
    tripWeekdays,
    filter,
    hasRoutes: routes.length > 0,
  }
}
