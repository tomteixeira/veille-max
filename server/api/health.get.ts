import { serverSupabaseServiceRole } from '#supabase/server'

export interface HealthReport {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unreachable'
}

/**
 * Liveness of the whole stack: Nitro answers and reaches Postgres through the
 * Supabase Data API (the `public.health()` probe of the initial migration).
 * Used by the end-to-end smoke test and by uptime checks.
 */
export default defineEventHandler(async (event): Promise<HealthReport> => {
  const { error } = await serverSupabaseServiceRole(event).rpc('health')

  if (error) {
    console.error('Health check: database unreachable', error.message)
    setResponseStatus(event, 503)
    return { status: 'degraded', database: 'unreachable' }
  }

  return { status: 'ok', database: 'ok' }
})
