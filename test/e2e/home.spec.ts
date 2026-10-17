import { expect, test } from '@playwright/test'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { logImprovement, saveTripTemplate, withLatestSnapshot, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

const parisLyonToPartDieu = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const partDieuToParisLyon = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

function isoWeekday(date: string): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

// A traveller of its own, since it has a trip template: it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('the home screen shows each tracked trip with the best candidate of each leg in the latest snapshot', async ({ page, request }) => {
  // The first trip leaves in 3 days and comes back in 5, whatever today is.
  const today = parisDate(new Date())
  const outboundDate = addDays(today, 3)
  const returnDate = addDays(today, 5)
  const train = (trainNumber: string, route: typeof parisLyonToPartDieu, date: string, departureTime: string, arrivalTime: string, open: boolean): FixtureTrain =>
    ({ trainNumber, ...route, date, departureTime, arrivalTime, open })

  const email = `accueil-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    // Arrive before 10:00, ideally at 09:00.
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu, parisLyonToPerrache] },
    // Leave after 14:00, ideally at 17:00.
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
  })
  const trains = [
    // Route 2 arrives at the ideal time, but route 1 is inside the window too: route 1 wins.
    train('9905', parisLyonToPerrache, outboundDate, '07:04', '09:00', true),
    train('9901', parisLyonToPartDieu, outboundDate, '07:00', '08:56', true),
    // No seat left: not a candidate.
    train('9903', parisLyonToPartDieu, outboundDate, '08:30', '09:26', false),
    // The return leg only has a train leaving before the window.
    train('9980', partDieuToParisLyon, returnDate, '13:00', '15:00', true),
  ]

  try {
    await withLatestSnapshot(trains, async () => {
      await signInThroughTheApp(page, request, email)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/week-ends? sous surveillance/)

      const tickets = page.getByRole('region', { name: 'Vos week-ends' }).getByRole('article')
      const firstTrip = tickets.first()
      const nextTrip = tickets.nth(1)

      await test.step('the outbound leg shows its best candidate, inside the window', async () => {
        const outbound = firstTrip.getByRole('region', { name: /^Aller/ })
        await expect(outbound).toContainText('Disponible')
        await expect(outbound).toContainText('07:00')
        await expect(outbound).toContainText('08:56')
        await expect(outbound).toContainText('Paris Gare de Lyon → Lyon Part-Dieu · 1 h 56')
      })

      await test.step('the return leg shows its only candidate, outside the window', async () => {
        const returnLeg = firstTrip.getByRole('region', { name: /^Retour/ })
        await expect(returnLeg).toContainText('Hors fenêtre')
        await expect(returnLeg).toContainText('13:00')
        await expect(returnLeg).toContainText('Lyon Part-Dieu → Paris Gare de Lyon · 2 h 00')
      })

      await test.step('the next trip has no train yet', async () => {
        for (const leg of [/^Aller/, /^Retour/]) {
          const half = nextTrip.getByRole('region', { name: leg })
          await expect(half).toContainText('Aucun train')
          await expect(half).toContainText('Rien pour l’instant')
        }
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the home screen lists this morning’s improvements under « Nouveautés », each opening its leg', async ({ page, request }) => {
  const today = parisDate(new Date())
  const outboundDate = addDays(today, 3)
  const returnDate = addDays(today, 5)
  const best: FixtureTrain = { trainNumber: '9911', ...parisLyonToPartDieu, date: outboundDate, departureTime: '07:00', arrivalTime: '08:56', open: true }
  const back: FixtureTrain = { trainNumber: '9981', ...partDieuToParisLyon, date: returnDate, departureTime: '17:04', arrivalTime: '19:00', open: true }

  const email = `nouveautes-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu] },
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
  })

  try {
    await withLatestSnapshot([best, back], async (snapshotId) => {
      await signInThroughTheApp(page, request, email)
      // The first trip's key, as the home screen links its legs.
      const firstLeg = page.getByRole('region', { name: 'Vos week-ends' }).getByRole('link', { name: /^Aller/ }).first()
      const tripKey = (await firstLeg.getAttribute('href'))!.split('/')[2]!
      await logImprovement(travellerId, snapshotId, tripKey, 'outbound', 'new-best', best)
      await logImprovement(travellerId, snapshotId, tripKey, 'return', 'first-candidate', back)
      await page.reload()

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/2 nouveaux trains\s*ce matin\./)
      const news = page.getByRole('region', { name: 'Nouveautés' }).getByRole('listitem')
      await expect(news).toHaveCount(2)
      await expect(news.first()).toContainText('Aller')
      await expect(news.first()).toContainText('Meilleur train')
      await expect(news.first()).toContainText('07:00')
      await expect(news.first()).toContainText('Paris Gare de Lyon → Lyon Part-Dieu')
      await expect(news.nth(1)).toContainText('Premier train')

      await news.first().getByRole('link').click()
      await expect(page).toHaveURL(new RegExp(`/trips/${tripKey}/outbound$`))
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the home view refuses a signed-out caller', async ({ request }) => {
  const response = await request.get('/api/home')

  expect(response.status()).toBe(401)
})
