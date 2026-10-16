import { expect, test, type Page } from '@playwright/test'
import { saveTripTemplate, withSnapshots, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

// Routes no other test uses: their history is this test's alone.
const nantesToRennes = { originCode: 'FRNTE', destinationCode: 'FRRNS' }
const rennesToNantes = { originCode: 'FRRNS', destinationCode: 'FRNTE' }

function train(trainNumber: string, route: typeof nantesToRennes, date: string, departureTime: string, open: boolean): FixtureTrain {
  return { trainNumber, ...route, date, departureTime, arrivalTime: '23:00', open }
}

// Trains of January 2020, older than any other test's snapshot: this history starts first.
const friday = (open: boolean) => train('8401', nantesToRennes, '2020-01-10', '07:30', open)
const fridayNoon = (open: boolean) => train('8431', nantesToRennes, '2020-01-10', '12:00', open)
const sunday = (open: boolean) => train('8480', rennesToNantes, '2020-01-12', '18:00', open)
const tuesday = (open: boolean) => train('8411', nantesToRennes, '2020-01-07', '09:00', open)

/** Four morning snapshots, 1 to 4 January 2020. */
const history = [
  { takenAt: new Date('2020-01-01T05:24:00Z'), trains: [friday(false), fridayNoon(false), sunday(false), tuesday(false)] },
  // The Friday seats come out at D-8, the Tuesday one at D-5.
  { takenAt: new Date('2020-01-02T05:24:00Z'), trains: [friday(true), fridayNoon(true), sunday(false), tuesday(true)] },
  // The early Friday seat is taken after less than a day; the Sunday one comes out at D-9.
  { takenAt: new Date('2020-01-03T05:24:00Z'), trains: [friday(false), fridayNoon(true), sunday(true), tuesday(true)] },
  // The Sunday seat is taken after less than a day, the Tuesday one after a day.
  { takenAt: new Date('2020-01-04T05:24:00Z'), trains: [friday(false), fridayNoon(true), sunday(false), tuesday(false)] },
]

function card(page: Page, eyebrow: string) {
  return page.getByRole('main').getByRole('region').filter({ hasText: eyebrow })
}

// A traveller of its own, with a trip template: it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('the dashboard shows when seats come out on the traveller’s routes, on their trip weekdays or every day', async ({ page, request }) => {
  const email = `dashboard-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    outbound: { weekday: 5, anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [nantesToRennes] },
    return: { weekday: 7, anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [rennesToNantes] },
  })

  try {
    await withSnapshots(history, async () => {
      await signInThroughTheApp(page, request, email)
      await page.goto('/dashboard')

      const release = card(page, 'Sorties de places')
      const slots = card(page, 'Créneaux')
      const lifetimes = card(page, 'Durée de vie')

      await test.step('by default, the three charts count the trip weekdays only, since the first snapshot', async () => {
        await expect(page.getByText('Vos routes · depuis le 1 janv.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Vendredi & dimanche' })).toHaveAttribute('aria-pressed', 'true')

        await expect(release.getByRole('heading')).toHaveText('La plupart des places sortent à J-8.')
        await expect(release.getByRole('button', { name: /^J-\d+ :/ })).toHaveCount(31)

        await expect(slots.getByRole('heading')).toHaveText('Meilleur créneau : le vendredi de 11 h à 14 h, où 75 % des trains ont une place.')
        await expect(slots.getByRole('rowheader')).toHaveText(['Ven', 'Dim'])

        await expect(lifetimes.getByRole('heading')).toHaveText('100 % des places partent en moins d’un jour.')
        await expect(lifetimes.getByRole('listitem')).toHaveCount(5)
      })

      await test.step('tapping a column shows its value', async () => {
        await release.getByRole('button', { name: 'J-8 : 2 places' }).click()
        await expect(release.getByRole('status')).toHaveText('J-8 · 2 places')
      })

      await test.step('every day counts the other weekdays too', async () => {
        await page.getByRole('button', { name: 'Tous les jours' }).click()

        await expect(release.getByRole('heading')).toHaveText('Les places sortent en deux vagues : J-8 et J-5.')
        await expect(slots.getByRole('rowheader')).toHaveText(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'])
        await expect(lifetimes.getByRole('heading')).toHaveText('67 % des places partent en moins d’un jour.')
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the dashboard refuses a signed-out caller', async ({ request }) => {
  const response = await request.get('/api/dashboard')

  expect(response.status()).toBe(401)
})
