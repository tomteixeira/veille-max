import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultTripTemplate, type LegKind, type LegSettings, type Station, type TemplateLeg, type TripTemplate, type Weekday } from '../domain/trip-template'
import type { Database, Tables } from '../types/database.types'

// Reads and writes a traveller's trip template in Supabase (tables
// `template_legs` and `template_routes`) and the station reference. With a
// traveller's client, RLS limits every read and write to their own rows.

type Client = SupabaseClient<Database>

/** Every station a route can use, by name. */
export async function loadStations(client: Client): Promise<Station[]> {
  const { data, error } = await client.from('stations').select('code, name').order('name')
  if (error) throw error
  return data
}

/** Postgres `time` reads « HH:MM:SS »; the domain uses « HH:MM ». */
function hoursAndMinutes(time: string): string {
  return time.slice(0, 5)
}

/** The trip template of `travellerId`: their saved legs, and the default settings for any leg they never saved. */
export async function loadTripTemplate(client: Client, travellerId: string): Promise<TripTemplate> {
  const [legs, routes] = await Promise.all([
    client.from('template_legs').select().eq('user_id', travellerId),
    client.from('template_routes').select().eq('user_id', travellerId).order('rank'),
  ])
  if (legs.error) throw legs.error
  if (routes.error) throw routes.error

  const template = defaultTripTemplate()
  for (const row of legs.data) template[row.kind] = templateLeg(row, routes.data)
  return template
}

function templateLeg(row: Tables<'template_legs'>, routes: Tables<'template_routes'>[]): TemplateLeg {
  return { weekday: row.weekday as Weekday, ...legSettings(row, routes.filter(route => route.leg_kind === row.kind)) }
}

/** The settings of a leg row (template or customised trip) and its route rows, in rank order. */
export function legSettings(
  row: Pick<Tables<'template_legs'>, 'anchor' | 'window_start' | 'window_end' | 'ideal_time'>,
  routes: readonly Pick<Tables<'template_routes'>, 'origin_code' | 'destination_code'>[],
): LegSettings {
  return {
    anchor: row.anchor,
    window: {
      start: row.window_start === null ? null : hoursAndMinutes(row.window_start),
      end: row.window_end === null ? null : hoursAndMinutes(row.window_end),
    },
    idealTime: hoursAndMinutes(row.ideal_time),
    routes: routes.map(route => ({ originCode: route.origin_code, destinationCode: route.destination_code })),
  }
}

/** Saves one leg of the signed-in traveller's trip template, replacing its ranked routes, in one transaction. */
export async function saveTemplateLeg(client: Client, kind: LegKind, leg: TemplateLeg): Promise<void> {
  const { error } = await client.rpc('save_template_leg', {
    kind,
    weekday: leg.weekday,
    anchor: leg.anchor,
    window_start: leg.window.start ?? undefined,
    window_end: leg.window.end ?? undefined,
    ideal_time: leg.idealTime,
    routes: leg.routes.map(route => ({ origin_code: route.originCode, destination_code: route.destinationCode })),
  })
  if (error) throw error
}
