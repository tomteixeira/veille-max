import { expect, test, type Locator } from '@playwright/test'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

/** Searches a station by part of its name and picks it in the « + Ajouter une route » form. */
async function pickStation(sheet: Locator, field: string, search: string, station: string) {
  await sheet.getByRole('combobox', { name: field }).fill(search)
  await sheet.getByRole('listbox', { name: field }).getByRole('option', { name: station, exact: true }).click()
}

async function addRoute(sheet: Locator, origin: [search: string, station: string], destination: [search: string, station: string]) {
  await sheet.getByRole('button', { name: '+ Ajouter une route' }).click()
  await pickStation(sheet, 'Gare de départ', ...origin)
  await pickStation(sheet, 'Gare d’arrivée', ...destination)
  await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click()
}

// A traveller of its own, since it changes the trip template (« Votre week-end type »): it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('a new traveller configures their trip template, and finds it again after reloading', async ({ page, request }) => {
  const email = `week-end-type-${Date.now()}@veille-max.test`
  await inviteTraveller(email)

  try {
    await signInThroughTheApp(page, request, email)
    await page.goto('/settings')
    const outbound = page.getByRole('region', { name: /^Aller/ })
    const returnLeg = page.getByRole('region', { name: /^Retour/ })

    await test.step('a new traveller starts with a Friday outbound leg, a Sunday return leg and no routes', async () => {
      await expect(outbound.getByRole('heading')).toHaveText('Aller · Vendredi')
      await expect(returnLeg.getByRole('heading')).toHaveText('Retour · Dimanche')
      await expect(outbound).toContainText('Aucune route pour l’instant')
      await expect(returnLeg).toContainText('Aucune route pour l’instant')
    })

    await test.step('the outbound leg: Thursday, arriving before 10:30, ideally at 09:15, on two ranked routes', async () => {
      await outbound.getByRole('button', { name: 'Modifier l’aller' }).click()
      const sheet = page.getByRole('dialog', { name: 'Aller par défaut' })

      await sheet.getByRole('radio', { name: 'Jeudi' }).check()
      await sheet.getByRole('radio', { name: 'Arriver' }).check()
      await sheet.getByRole('radio', { name: 'avant' }).check()
      await sheet.getByLabel('Heure de la fenêtre').fill('10:30')
      await sheet.getByLabel('Arrivée idéale').fill('09:15')
      await expect(sheet.getByText('Arrivée acceptée jusqu’à 10:30 · idéale 09:15')).toBeVisible()

      await addRoute(sheet, ['gare de lyon', 'Paris Gare de Lyon'], ['part dieu', 'Lyon Part-Dieu'])
      await addRoute(sheet, ['bercy', 'Paris Bercy'], ['part-dieu', 'Lyon Part-Dieu'])
      await sheet.getByRole('button', { name: 'Monter Paris Bercy → Lyon Part-Dieu' }).click()
      await expect(sheet.getByRole('listitem')).toHaveText([/Paris Bercy → Lyon Part-Dieu/, /Paris Gare de Lyon → Lyon Part-Dieu/])

      // The same route cannot be ranked twice.
      await sheet.getByRole('button', { name: '+ Ajouter une route' }).click()
      await pickStation(sheet, 'Gare de départ', 'paris gare de', 'Paris Gare de Lyon')
      await pickStation(sheet, 'Gare d’arrivée', 'lyon part', 'Lyon Part-Dieu')
      await expect(sheet.getByRole('alert')).toHaveText('Cette route est déjà dans la liste.')
      await expect(sheet.getByRole('button', { name: 'Ajouter', exact: true })).toBeDisabled()

      await sheet.getByRole('button', { name: 'OK' }).click()
      await expect(sheet).toBeHidden()
      await expect(outbound.getByRole('heading')).toHaveText('Aller · Jeudi')
    })

    await test.step('the return leg: Monday, leaving after 15:30, ideally at 18:00, on two ranked routes', async () => {
      await returnLeg.getByRole('button', { name: 'Modifier le retour' }).click()
      const sheet = page.getByRole('dialog', { name: 'Retour par défaut' })

      await sheet.getByRole('radio', { name: 'Lundi' }).check()
      await sheet.getByRole('radio', { name: 'Partir' }).check()
      await sheet.getByRole('radio', { name: 'après' }).check()
      await sheet.getByLabel('Heure de la fenêtre').fill('15:30')
      await sheet.getByLabel('Départ idéal').fill('18:00')

      await addRoute(sheet, ['part dieu', 'Lyon Part-Dieu'], ['gare de lyon', 'Paris Gare de Lyon'])
      await addRoute(sheet, ['saint exupery', 'Lyon St-Exupéry TGV'], ['gare de lyon', 'Paris Gare de Lyon'])
      await addRoute(sheet, ['perrache', 'Lyon Perrache'], ['gare de lyon', 'Paris Gare de Lyon'])
      await sheet.getByRole('button', { name: 'Retirer Lyon St-Exupéry TGV → Paris Gare de Lyon' }).click()
      await sheet.getByRole('button', { name: 'Descendre Lyon Part-Dieu → Paris Gare de Lyon' }).click()
      await expect(sheet.getByRole('listitem')).toHaveText([/Lyon Perrache → Paris Gare de Lyon/, /Lyon Part-Dieu → Paris Gare de Lyon/])

      await sheet.getByRole('button', { name: 'OK' }).click()
      await expect(sheet).toBeHidden()
    })

    await test.step('« Annuler » drops the changes of an editor', async () => {
      await returnLeg.getByRole('button', { name: 'Modifier le retour' }).click()
      const sheet = page.getByRole('dialog', { name: 'Retour par défaut' })
      await sheet.getByRole('radio', { name: 'Samedi' }).check()
      await sheet.getByRole('button', { name: 'Annuler' }).click()
      await expect(sheet).toBeHidden()
      await expect(returnLeg.getByRole('heading')).toHaveText('Retour · Lundi')
    })

    await page.reload()

    await test.step('after reloading, the ticket shows both legs as configured', async () => {
      await expect(outbound.getByRole('heading')).toHaveText('Aller · Jeudi')
      await expect(outbound).toContainText('Arriver avant')
      await expect(outbound).toContainText('10:30')
      await expect(outbound).toContainText('Arrivée acceptée jusqu’à 10:30 · idéale 09:15')
      await expect(outbound.getByRole('listitem')).toHaveText([/Paris Bercy → Lyon Part-Dieu/, /Paris Gare de Lyon → Lyon Part-Dieu/])

      await expect(returnLeg.getByRole('heading')).toHaveText('Retour · Lundi')
      await expect(returnLeg).toContainText('Partir après')
      await expect(returnLeg).toContainText('15:30')
      await expect(returnLeg).toContainText('Départ accepté à partir de 15:30 · idéal 18:00')
      await expect(returnLeg.getByRole('listitem')).toHaveText([/Lyon Perrache → Paris Gare de Lyon/, /Lyon Part-Dieu → Paris Gare de Lyon/])
    })

    await test.step('after reloading, the editor opens on the saved settings', async () => {
      await outbound.getByRole('button', { name: 'Modifier l’aller' }).click()
      const sheet = page.getByRole('dialog', { name: 'Aller par défaut' })
      await expect(sheet.getByRole('radio', { name: 'Jeudi' })).toBeChecked()
      await expect(sheet.getByRole('radio', { name: 'Arriver' })).toBeChecked()
      await expect(sheet.getByRole('radio', { name: 'avant' })).toBeChecked()
      await expect(sheet.getByLabel('Heure de la fenêtre')).toHaveValue('10:30')
      await expect(sheet.getByLabel('Arrivée idéale')).toHaveValue('09:15')
      await expect(sheet.getByRole('listitem')).toHaveText([/Paris Bercy → Lyon Part-Dieu/, /Paris Gare de Lyon → Lyon Part-Dieu/])
    })
  }
  finally {
    await removeTraveller(email)
  }
})
