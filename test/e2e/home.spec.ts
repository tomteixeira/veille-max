import { expect, test } from '@playwright/test'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { recordSnapshot, removeSnapshot, saveTripTemplate, type FixtureTrain } from './support/snapshots'
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
  const snapshotId = await recordSnapshot([
    // Route 2 arrives at the ideal time, but route 1 is inside the window too: route 1 wins.
    train('9905', parisLyonToPerrache, outboundDate, '07:04', '09:00', true),
    train('9901', parisLyonToPartDieu, outboundDate, '07:00', '08:56', true),
    // No seat left: not a candidate.
    train('9903', parisLyonToPartDieu, outboundDate, '08:30', '09:26', false),
    // The return leg only has a train leaving before the window.
    train('9980', partDieuToParisLyon, returnDate, '13:00', '15:00', true),
  ])

  try {
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
  }
  finally {
    await removeSnapshot(snapshotId)
    await removeTraveller(email)
  }
})

test('the home view refuses a signed-out caller', async ({ request }) => {
  const response = await request.get('/api/home')

  expect(response.status()).toBe(401)
})
