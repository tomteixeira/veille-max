import { expect, test } from '@playwright/test'

test('the tick endpoint refuses a call without the shared secret', async ({ request }) => {
  const withoutSecret = await request.post('/api/cron/tick')
  const withAnotherSecret = await request.post('/api/cron/tick', { headers: { 'x-tick-secret': 'not-the-secret' } })

  expect(withoutSecret.status()).toBe(401)
  expect(withAnotherSecret.status()).toBe(401)
})
