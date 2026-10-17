import { expect, test, type Locator } from '@playwright/test'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { saveTripTemplate, withLatestSnapshot, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

const parisLyonToPartDieu = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToMarseille = { originCode: 'FRPLY', destinationCode: 'FRMSC' }
const partDieuToParisLyon = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

function isoWeekday(date: string): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

/** Searches a station by part of its name and picks it in the « + Ajouter une route » form. */
async function pickStation(sheet: Locator, field: string, search: string, station: string) {
  await sheet.getByRole('combobox', { name: field }).fill(search)
  await sheet.getByRole('listbox', { name: field }).getByRole('option', { name: station, exact: true }).click()
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('not laid out')
  return box
}

/**
 * The trip's chips share the « Week-end » line, clear of « Modifier », and the
 * trip's Aller half stays level with the next trip's, which has no chips.
 */
async function expectChipsBesideEyebrow(trip: Locator, chips: Locator[]) {
  const eyebrow = await boxOf(trip.getByText('Week-end', { exact: true }))
  const modify = await boxOf(trip.getByRole('link', { name: /^Modifier/ }))
  for (const chip of chips) {
    const box = await boxOf(chip)
    expect(Math.abs((box.y + box.height / 2) - (eyebrow.y + eyebrow.height / 2))).toBeLessThan(2)
    expect(box.x + box.width).toBeLessThanOrEqual(modify.x)
  }

  const weekends = trip.page().getByRole('region', { name: 'Vos week-ends' }).getByRole('article')
  const outbound = await boxOf(trip.getByRole('region', { name: /^Aller/ }))
  const neighbourOutbound = await boxOf(weekends.nth(1).getByRole('region', { name: /^Aller/ }))
  expect(Math.abs(outbound.y - neighbourOutbound.y)).toBeLessThan(1)
}

// A traveller of its own, since it has a trip template: it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('a traveller customises a trip to another destination, mutes a leg, then resets the trip', async ({ page, request }) => {
  // The first trip leaves in 3 days and comes back in 5, whatever today is.
  const today = parisDate(new Date())
  const outboundDate = addDays(today, 3)
  const returnDate = addDays(today, 5)
  const train = (trainNumber: string, route: typeof parisLyonToPartDieu, date: string, departureTime: string, arrivalTime: string): FixtureTrain =>
    ({ trainNumber, ...route, date, departureTime, arrivalTime, open: true })

  const email = `personnalise-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu] },
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
  })
  const trains = [
    train('9901', parisLyonToPartDieu, outboundDate, '07:00', '08:56'),
    train('9971', parisLyonToMarseille, outboundDate, '06:07', '09:24'),
    train('9980', partDieuToParisLyon, returnDate, '17:04', '19:00'),
  ]

  try {
    await withLatestSnapshot(trains, async () => {
      await signInThroughTheApp(page, request, email)
      const firstTrip = page.getByRole('region', { name: 'Vos week-ends' }).getByRole('article').first()
      const outboundHalf = firstTrip.getByRole('region', { name: /^Aller/ })
      const returnHalf = firstTrip.getByRole('region', { name: /^Retour/ })

      await test.step('the first trip follows the trip template, to Lyon', async () => {
        await expect(outboundHalf).toContainText('Paris Gare de Lyon → Lyon Part-Dieu')
        await expect(firstTrip).not.toContainText('Personnalisé')
      })

      await test.step('the next two weekends beyond the horizon can be prepared in advance', async () => {
        const upcoming = page.getByRole('region', { name: 'Bientôt ouverts' }).getByRole('listitem')
        await expect(upcoming).toHaveCount(2)
        await expect(upcoming.first()).toContainText(/Ouverture le \d{2}\/\d{2}/)
        await expect(upcoming.first().getByRole('link', { name: /^Préparer/ })).toBeVisible()
      })

      await test.step('changing the outbound leg to Marseille customises the trip', async () => {
        await firstTrip.getByRole('link', { name: /^Modifier/ }).click()
        await expect(page).toHaveURL(/\/trips\/\d{4}-W\d{2}$/)
        await page.getByRole('region', { name: /^Aller/ }).getByRole('button', { name: 'Modifier l’aller' }).click()
        const sheet = page.getByRole('dialog', { name: /^Aller du/ })

        await sheet.getByRole('button', { name: 'Retirer Paris Gare de Lyon → Lyon Part-Dieu' }).click()
        await sheet.getByRole('button', { name: '+ Ajouter une route' }).click()
        await pickStation(sheet, 'Gare de départ', 'gare de lyon', 'Paris Gare de Lyon')
        await pickStation(sheet, 'Gare d’arrivée', 'marseille st', 'Marseille St-Charles')
        await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click()
        await sheet.getByRole('button', { name: 'OK' }).click()

        await expect(sheet).toBeHidden()
        await expect(page.getByText('Personnalisé')).toBeVisible()
        await expect(page.getByRole('region', { name: /^Aller/ })).toContainText('Paris Gare de Lyon → Marseille St-Charles')
      })

      await test.step('the home screen ranks the customised trip’s trains', async () => {
        await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
        await expect(firstTrip).toContainText('Personnalisé')
        await expect(outboundHalf).toContainText('06:07')
        await expect(outboundHalf).toContainText('Paris Gare de Lyon → Marseille St-Charles')
      })

      await test.step('« Personnalisé » sits beside « Week-end », so the ticket stays aligned with its neighbour', async () => {
        await expectChipsBesideEyebrow(firstTrip, [firstTrip.getByText('Personnalisé')])
      })

      await test.step('a muted trip shows « En sourdine » as an icon, so both chips fit beside « Week-end »', async () => {
        await firstTrip.getByRole('link', { name: /^Modifier/ }).click()
        const muteTrip = page.getByRole('switch', { name: 'Mettre le week-end en sourdine' })
        await muteTrip.click()
        await expect(muteTrip).toHaveAttribute('aria-checked', 'true')
        await page.getByRole('link', { name: 'Retour à l’accueil' }).click()

        await expectChipsBesideEyebrow(firstTrip, [firstTrip.getByText('Personnalisé'), firstTrip.getByRole('img', { name: 'En sourdine' })])

        await firstTrip.getByRole('link', { name: /^Modifier/ }).click()
        await muteTrip.click()
        await expect(muteTrip).toHaveAttribute('aria-checked', 'false')
        await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
      })

      await test.step('a muted return leg keeps its candidate, « En sourdine »', async () => {
        await firstTrip.getByRole('link', { name: /^Modifier/ }).click()
        const muteReturn = page.getByRole('switch', { name: 'Mettre le retour en sourdine' })
        await muteReturn.click()
        await expect(muteReturn).toHaveAttribute('aria-checked', 'true')

        await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
        await expect(returnHalf).toContainText('En sourdine')
        await expect(returnHalf).toContainText('17:04')
        await expect(outboundHalf).not.toContainText('En sourdine')
      })

      await test.step('resetting the trip gives it back to the trip template, still muted', async () => {
        await firstTrip.getByRole('link', { name: /^Modifier/ }).click()
        await page.getByRole('button', { name: 'Réinitialiser' }).click()
        await expect(page.getByText('Personnalisé')).toBeHidden()
        await expect(page.getByRole('region', { name: /^Aller/ })).toContainText('Paris Gare de Lyon → Lyon Part-Dieu')

        await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
        await expect(firstTrip).not.toContainText('Personnalisé')
        await expect(outboundHalf).toContainText('07:00')
        await expect(returnHalf).toContainText('En sourdine')
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})
