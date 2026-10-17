import { expect, test, type Locator } from '@playwright/test'
import { fakeHomeScreen, fakePush } from './support/push'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

/** Searches a station by part of its name and picks it in the « + Ajouter une route » form. */
async function pickStation(sheet: Locator, field: string, search: string, station: string) {
  await sheet.getByRole('combobox', { name: field }).fill(search)
  await sheet.getByRole('listbox', { name: field }).getByRole('option', { name: station, exact: true }).click()
}

// A traveller of its own, new to the app: they start signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('a new traveller goes through onboarding, and the banner reminds them of each skipped step until all are done', async ({ page, request }) => {
  const email = `onboarding-${Date.now()}@veille-max.test`
  await inviteTraveller(email, { onboarded: false })
  // An iPhone that can receive notifications once the traveller allows them.
  await fakePush(page, { supported: true, permission: 'default', answer: 'granted' })

  const banner = page.getByRole('complementary', { name: 'Configuration à terminer' })

  try {
    await test.step('after their first sign-in, the traveller lands on the first step', async () => {
      await signInThroughTheApp(page, request, email, '/onboarding')
      await expect(page.getByText('Étape 1 sur 3')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Votre week-end type')
    })

    await test.step('step 1 reuses the default configuration editor', async () => {
      await page.getByRole('button', { name: 'Modifier l’aller' }).click()
      const sheet = page.getByRole('dialog', { name: 'Aller par défaut' })
      await sheet.getByRole('button', { name: '+ Ajouter une route' }).click()
      await pickStation(sheet, 'Gare de départ', 'gare de lyon', 'Paris Gare de Lyon')
      await pickStation(sheet, 'Gare d’arrivée', 'part dieu', 'Lyon Part-Dieu')
      await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click()
      await sheet.getByRole('button', { name: 'OK' }).click()
      await expect(sheet).toBeHidden()

      await expect(page.getByRole('status').filter({ hasText: 'Week-end type configuré' })).toBeVisible()
      await page.getByRole('button', { name: 'Continuer' }).click()
    })

    await test.step('step 2 shows how to add the app to the home screen, and its progress survives a reload', async () => {
      await expect(page.getByText('Étape 2 sur 3')).toBeVisible()
      const instructions = page.getByRole('list', { name: 'Ajouter Veille MAX à l’écran d’accueil' })
      await expect(instructions.getByRole('listitem')).toHaveText([/touchez Partager/, /« Sur l’écran d’accueil »/, /Ouvrez Veille MAX/])

      await page.reload()
      await expect(page.getByText('Étape 2 sur 3')).toBeVisible()
      await page.getByRole('button', { name: 'Passer cette étape' }).click()
    })

    await test.step('step 3 can be skipped too, which ends the flow', async () => {
      await expect(page.getByText('Étape 3 sur 3')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Activer les notifications sur cet iPhone' })).toBeEnabled()
      await page.getByRole('button', { name: 'Passer cette étape' }).click()
      await expect(page).toHaveURL('/')
    })

    await test.step('the home screen names the first skipped step', async () => {
      await expect(banner).toContainText('Veille MAX n’est pas sur l’écran d’accueil')
      await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
    })

    await test.step('once the app runs from the home screen, the installation is done', async () => {
      await fakeHomeScreen(page)
      await page.reload()
      await expect(banner).toContainText('Les notifications sont désactivées')

      await page.goto('/settings')
      await expect(page.getByRole('region', { name: 'Compte et application' })).toContainText('Installée sur l’écran d’accueil')
      await page.goto('/')
    })

    await test.step('the banner links back to the missing step, which turns notifications on', async () => {
      await banner.getByRole('link', { name: 'Activer' }).click()
      await expect(page).toHaveURL('/onboarding?step=notifications')
      await page.getByRole('button', { name: 'Activer les notifications sur cet iPhone' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Notifications activées' })).toBeVisible()
      await page.getByRole('button', { name: 'Terminer' }).click()
    })

    await test.step('once every step is done, the banner is gone', async () => {
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/week-ends? sous surveillance/)
      await expect(banner).toBeHidden()
    })
  }
  finally {
    await removeTraveller(email)
  }
})
