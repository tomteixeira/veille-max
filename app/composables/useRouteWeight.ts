import { DEFAULT_ROUTE_WEIGHT } from '#shared/domain/evaluation'
import { loadRouteWeight, saveRouteWeight } from '#shared/utils/traveller-settings-store'

/**
 * The signed-in traveller's route weight, loaded before the page shows and
 * written straight to Supabase under RLS (spec, "Settings writes").
 */
export async function useRouteWeight() {
  const supabase = useSupabaseClient()
  const travellerId = useSupabaseUser().value?.sub

  const loading = useAsyncData(`route-weight-${travellerId}`, async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    return loadRouteWeight(supabase, travellerId)
  })
  const { data } = loading

  async function save(routeWeight: number): Promise<void> {
    if (!travellerId) throw new Error('No signed-in traveller')
    await saveRouteWeight(supabase, travellerId, routeWeight)
    data.value = routeWeight
  }

  // Last, so that every composable above runs in the component's setup context.
  await loading

  return { routeWeight: computed(() => data.value ?? DEFAULT_ROUTE_WEIGHT), save }
}
