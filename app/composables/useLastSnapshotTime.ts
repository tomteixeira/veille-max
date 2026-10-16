import { loadLastSnapshot } from '#shared/utils/snapshot-store'

/**
 * « 16 octobre, 06:24 »: when SNCF took the last snapshot the app ingested,
 * in Paris time, or `null` before the first one.
 */
export async function useLastSnapshotTime() {
  const supabase = useSupabaseClient()

  // An ISO string, which the server's payload carries to the browser as is.
  const loading = useAsyncData('last-snapshot', async () => (await loadLastSnapshot(supabase))?.processedAt.toISOString() ?? null)
  const { data } = loading

  await loading

  return computed(() => data.value ? formatParisSnapshotTime(new Date(data.value)) : null)
}
