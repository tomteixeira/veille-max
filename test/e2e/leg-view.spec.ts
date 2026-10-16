import { expect, test, type Page } from '@playwright/test'
import { sncfConnectSearchLink } from '../../shared/domain/sncf-connect'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { saveTripTemplate, withLatestSnapshot, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

const parisLyonToPartDieu = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const chessyToPartDieu = { originCode: 'FRMLV', destinationCode: 'FRLPD' }
const partDieuToParisLyon = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

function isoWeekday(date: string): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

/** The tickets the leg view shows, top to bottom. */
function shownTrains(page: Page) {
  return page.getByRole('region', { name: 'Trains' }).getByRole('article')
}

// A traveller of its own, since it has a trip template and changes its route weight: it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('the leg view lists every candidate as a ticket, filters by route, and follows the route weight', async ({ page, request }) => {
  // The first trip leaves in 3 days and comes back in 5, whatever today is.
  const today = parisDate(new Date())
  const outboundDate = addDays(today, 3)
  const returnDate = addDays(today, 5)
  const train = (trainNumber: string, route: typeof parisLyonToPartDieu, departureTime: string, arrivalTime: string): FixtureTrain =>
    ({ trainNumber, ...route, date: outboundDate, departureTime, arrivalTime, open: true })

  const email = `trajet-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    // Arrive before 10:00, ideally at 09:00, on three ranked routes.
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu, parisLyonToPerrache, chessyToPartDieu] },
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
  })
  const trains = [
    train('9905', parisLyonToPerrache, '07:04', '09:00'),
    train('9901', parisLyonToPartDieu, '07:00', '08:56'),
    // Out of the window: route 1 arrives 60 minutes late, route 3 arrives 25 minutes late.
    train('9931', chessyToPartDieu, '08:27', '10:25'),
    train('9909', parisLyonToPartDieu, '09:04', '11:00'),
  ]

  try {
    await withLatestSnapshot(trains, async () => {
      await signInThroughTheApp(page, request, email)

      await test.step('tapping a home ticket half opens its leg view', async () => {
        const firstTrip = page.getByRole('region', { name: 'Vos week-ends' }).getByRole('article').first()
        await firstTrip.getByRole('link', { name: /^Aller/ }).click()
        await expect(page).toHaveURL(/\/trips\/\d{4}-W\d{2}\/outbound$/)
      })

      await test.step('the leg view shows the leg, its candidate count, its window and the snapshot time', async () => {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('4 trains disponibles')
        await expect(page.getByRole('main').getByText(/^Aller · /)).toBeVisible()
        await expect(page.getByText('Arrivée avant 10:00')).toBeVisible()
        await expect(page.getByText('idéale 09:00')).toBeVisible()
        await expect(page.getByText('Dernier instantané :')).toBeVisible()
      })

      await test.step('every candidate is a ticket, in ranking order, the best one first, out-of-window ones last', async () => {
        const tickets = shownTrains(page)
        await expect(tickets).toHaveCount(4)
        await expect(tickets.nth(0)).toContainText('Meilleur choix')
        await expect(tickets.nth(0)).toContainText('Route 1')
        await expect(tickets.nth(0)).toContainText('À 4 min de l’heure idéale')
        await expect(tickets.nth(0)).toContainText('Paris Gare de Lyon')
        await expect(tickets.nth(0)).toContainText('Lyon Part-Dieu')
        await expect(tickets.nth(0)).toContainText('1 h 56 · train 9901')
        await expect(tickets.nth(1)).toContainText('Pile à l’heure idéale')
        await expect(tickets.nth(1)).not.toContainText('Meilleur choix')
        await expect(tickets.nth(2)).toContainText('1 h 00 hors fenêtre')
        await expect(tickets.nth(3)).toContainText('25 min hors fenêtre + 2 rangs × 30 min')
        await expect(tickets.nth(3)).toContainText('Marne-la-Vallée – Chessy')
        await expect(tickets).toHaveText([/train 9901/, /train 9905/, /train 9909/, /train 9931/])
      })

      await test.step('« Réserver » and « Vérifier en direct » open pre-filled SNCF Connect searches', async () => {
        const best = shownTrains(page).first()
        await expect(best.getByRole('link', { name: /^Réserver/ }))
          .toHaveAttribute('href', sncfConnectSearchLink(parisLyonToPartDieu, outboundDate, '07:00'))
        // The window has no start: from the start of the day, on the first route.
        await expect(page.getByRole('link', { name: 'Vérifier en direct sur SNCF Connect' }))
          .toHaveAttribute('href', sncfConnectSearchLink(parisLyonToPartDieu, outboundDate, '00:00'))
      })

      await test.step('the route chips filter the tickets', async () => {
        const filters = page.getByRole('group', { name: 'Filtrer par route' }).getByRole('button')
        await expect(filters).toHaveText([
          'Tous',
          '1 · Paris Gare de Lyon → Lyon Part-Dieu',
          '2 · Paris Gare de Lyon → Lyon Perrache',
          '3 · Marne-la-Vallée – Chessy → Lyon Part-Dieu',
        ])

        await filters.nth(2).click()
        await expect(filters.nth(2)).toHaveAttribute('aria-pressed', 'true')
        await expect(shownTrains(page)).toHaveText([/train 9905/])

        await filters.nth(1).click()
        await expect(shownTrains(page)).toHaveText([/train 9901/, /train 9909/])

        await filters.first().click()
        await expect(shownTrains(page)).toHaveCount(4)
      })

      const legView = page.url()

      await test.step('with a route weight of 10, the later train from route 3 overtakes route 1', async () => {
        await page.goto('/settings')
        const card = page.getByRole('region', { name: 'Pondération des gares' })
        await expect(card).toContainText('30 min')
        await expect(card).toContainText('→ La route 1 passe en premier.')

        await card.getByLabel('1 rang de gare vaut').fill('10')
        await expect(card).toContainText('→ La route 3 passe en premier.')
        await expect(card.getByText('Enregistré', { exact: true })).toBeVisible()

        await page.goto(legView)
        await expect(shownTrains(page)).toHaveText([/train 9901/, /train 9905/, /train 9931/, /train 9909/])
      })

      await test.step('the route weight is kept', async () => {
        await page.goto('/settings')
        await expect(page.getByRole('region', { name: 'Pondération des gares' }).getByLabel('1 rang de gare vaut')).toHaveValue('10')
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the leg view refuses a signed-out caller', async ({ request }) => {
  const response = await request.get('/api/trips/2026-W43/legs/outbound')

  expect(response.status()).toBe(401)
})
