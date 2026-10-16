import { expect, test } from '@playwright/test'

test('the server reaches the local Supabase database', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok', database: 'ok' })
})

test('the French app shell navigates between Accueil, Dashboard and Réglages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page).toHaveTitle('Accueil · Veille MAX')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Rien à surveiller/)
  await expect(page.getByText('Veille MAX n’est pas affilié à SNCF Voyageurs')).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Réglages' }).click()
  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Votre week-end type' })).toBeVisible()

  expect(errors).toEqual([])
})
