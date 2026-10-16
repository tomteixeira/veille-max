import { customiseTrip, type Trip, type UpcomingTrip } from '#shared/domain/evaluation'
import type { LegKind, LegSettings, Station } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'
import { resetTrip, saveCustomisedTrip, setMute } from '#shared/utils/trip-store'
import { loadStations } from '#shared/utils/trip-template-store'

/**
 * One of the signed-in traveller's trips, tracked or upcoming, as the home
 * view evaluates it, with the stations its routes can use. Changes are written
 * straight to Supabase under RLS (spec, "Settings writes"), then the trip is
 * evaluated again.
 */
export async function useTrip(key: string) {
  const supabase = useSupabaseClient()

  // The same request as the home screen's: going back home shows the change.
  const home = useFetch('/api/home')
  const stations = useAsyncData('stations', () => loadStations(supabase))
  const { data, status, refresh } = home

  const trip = computed((): Trip | UpcomingTrip | null =>
    [...data.value?.trips ?? [], ...data.value?.upcoming ?? []].find(trip => trip.key === key) ?? null)
  const stationNames = computed(() => new Map(stations.data.value?.map(station => [station.code, station.name])))

  /** A station's full name; its code if the station reference does not know it. */
  function stationName(code: string): string {
    return stationNames.value.get(code) ?? data.value?.stationNames[code] ?? code
  }

  function current(): Trip {
    if (!trip.value) throw new Error(`No trip ${key}`)
    return trip.value
  }

  /** Changes a leg: the first change customises the trip, detaching it from the trip template. */
  async function saveLeg(kind: LegKind, date: ParisDate, settings: LegSettings): Promise<void> {
    await saveCustomisedTrip(supabase, key, customiseTrip(current(), kind, { ...settings, date }))
    await resetLegReferences()
    await refresh()
  }

  /** Gives the trip back to the trip template. */
  async function reset(): Promise<void> {
    await resetTrip(supabase, key)
    await resetLegReferences()
    await refresh()
  }

  /** Mutes or unmutes the whole trip, or only its `leg`. */
  async function mute(muted: boolean, leg?: LegKind): Promise<void> {
    await setMute(supabase, leg ? { tripKey: key, leg } : { tripKey: key }, muted)
    await refresh()
  }

  // Last, so that every composable above runs in the component's setup context.
  await Promise.all([home, stations])

  return {
    trip,
    stations: computed((): readonly Station[] => stations.data.value ?? []),
    status,
    refresh,
    stationName,
    saveLeg,
    reset,
    mute,
  }
}
