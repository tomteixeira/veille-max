import type { LegKind, Station, TemplateLeg } from '#shared/domain/trip-template'
import { loadStations, loadTripTemplate, saveTemplateLeg } from '#shared/utils/trip-template-store'

/**
 * The signed-in traveller's trip template, with the stations its routes can
 * use. Loaded before the page shows, written straight to Supabase under RLS
 * (spec, "Settings writes").
 */
export async function useTripTemplate() {
  const supabase = useSupabaseClient()
  const travellerId = useSupabaseUser().value?.sub

  const loading = useAsyncData(`trip-template-${travellerId}`, async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    const [template, stations] = await Promise.all([loadTripTemplate(supabase, travellerId), loadStations(supabase)])
    return { template, stations }
  })
  const { data, status, refresh } = loading

  const stationNames = computed(() => new Map(data.value?.stations.map(station => [station.code, station.name])))

  /** A station's full name; its code if the station reference does not know it. */
  function stationName(code: string): string {
    return stationNames.value.get(code) ?? code
  }

  async function saveLeg(kind: LegKind, leg: TemplateLeg): Promise<void> {
    await saveTemplateLeg(supabase, kind, leg)
    // The data is a shallow ref: replace it for the page to see the change.
    if (data.value) data.value = { ...data.value, template: { ...data.value.template, [kind]: leg } }
  }

  // Last, so that every composable above runs in the component's setup context.
  await loading

  return {
    template: computed(() => data.value?.template ?? null),
    stations: computed((): readonly Station[] => data.value?.stations ?? []),
    status,
    refresh,
    stationName,
    saveLeg,
  }
}
