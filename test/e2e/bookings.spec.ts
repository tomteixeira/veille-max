import { expect, test, type Page } from '@playwright/test'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { saveTripTemplate, withLatestSnapshot, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

const parisLyonToPartDieu = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const partDieuToParisLyon = { originCode: 'FRLPD', destinationCode: 'FRPLY' }

function isoWeekday(date: string): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

/** The candidate tickets the leg view shows, top to bottom. */
function shownTrains(page: Page) {
  return page.getByRole('region', { name: 'Trains' }).getByRole('article')
}

function bookingCard(page: Page) {
  return page.getByRole('region', { name: 'Votre billet' })
}

function firstTrip(page: Page) {
  return page.getByRole('region', { name: 'Vos week-ends' }).getByRole('article').first()
}

// A traveller of its own, since it declares bookings: it starts signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('a traveller declares a booking from a candidate or from every train of the day, replaces it and cancels it', async ({ page, request }) => {
  // The first trip leaves in 3 days and comes back in 5, whatever today is.
  const today = parisDate(new Date())
  const outboundDate = addDays(today, 3)
  const returnDate = addDays(today, 5)
  const train = (trainNumber: string, route: typeof parisLyonToPartDieu, departureTime: string, arrivalTime: string, open = true): FixtureTrain =>
    ({ trainNumber, ...route, date: outboundDate, departureTime, arrivalTime, open })

  const email = `reservation-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    // Arrive before 10:00, ideally at 09:00, on two ranked routes.
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [parisLyonToPartDieu, parisLyonToPerrache] },
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [partDieuToParisLyon] },
  })
  const trains = [
    train('9901', parisLyonToPartDieu, '07:00', '08:56'),
    train('9911', parisLyonToPerrache, '07:10', '09:06'),
    // No seat left: only « Déclarer une réservation » lists it. Right on the ideal time, on route 1.
    train('9903', parisLyonToPartDieu, '07:04', '09:00', false),
  ]

  try {
    await withLatestSnapshot(trains, async () => {
      await signInThroughTheApp(page, request, email)
      await expect(page.getByText('0/6 réservés')).toBeVisible()
      await firstTrip(page).getByRole('link', { name: /^Aller/ }).click()
      await expect(page).toHaveURL(/\/trips\/\d{4}-W\d{2}\/outbound$/)
      const legView = page.url()

      await test.step('« J’ai réservé » on a candidate declares it, ranked against the candidates', async () => {
        await expect(bookingCard(page)).toHaveCount(0)
        await shownTrains(page).filter({ hasText: 'train 9911' }).getByRole('button', { name: 'J’ai réservé' }).click()

        await expect(bookingCard(page)).toContainText('07:10 → 09:06')
        await expect(bookingCard(page)).toContainText('Route 2')
        await expect(bookingCard(page)).toContainText('train 9911')
        await expect(bookingCard(page)).toContainText('1 train fait mieux')
        await expect(shownTrains(page).filter({ hasText: 'train 9901' })).toContainText('Mieux que votre billet')
        const booked = shownTrains(page).filter({ hasText: 'train 9911' })
        await expect(booked).toContainText('Réservé')
        await expect(booked).not.toContainText('Mieux que votre billet')
        await expect(booked.getByRole('button', { name: 'J’ai réservé' })).toHaveCount(0)
      })

      await test.step('the home card shows « Réservé » with the booked train, and the count of bookings', async () => {
        await page.goto('/')
        await expect(page.getByText('1/6 réservés')).toBeVisible()
        const outbound = firstTrip(page).getByRole('region', { name: /^Aller/ })
        await expect(outbound).toContainText('Réservé')
        await expect(outbound).toContainText('07:10')
        await expect(outbound).toContainText('Lyon Perrache')
      })

      await test.step('« Déclarer une réservation » lists every train of the day, even without a seat, and replaces the booking', async () => {
        await page.goto(legView)
        await page.getByRole('button', { name: 'Déclarer une autre réservation' }).click()
        const sheet = page.getByRole('dialog', { name: 'Déclarer une réservation' })
        const listed = sheet.getByRole('listitem')
        await expect(listed).toHaveText([/07:00 → 08:56.*train 9901/, /07:04 → 09:00\s*Complet.*train 9903/, /07:10 → 09:06.*train 9911/])
        await expect(listed.nth(2)).toContainText('Réservé')

        await listed.nth(1).getByRole('button', { name: /^Choisir/ }).click()
        await expect(sheet).toBeHidden()

        await expect(bookingCard(page)).toContainText('07:04 → 09:00')
        await expect(bookingCard(page)).toContainText('train 9903')
        await expect(bookingCard(page)).toContainText('Rien de mieux pour l’instant')
        await expect(page.getByText('Mieux que votre billet')).toHaveCount(0)
        await expect(shownTrains(page).filter({ hasText: 'train 9911' }).getByRole('button', { name: 'J’ai réservé' })).toBeVisible()
      })

      await test.step('cancelling the booking puts the leg back to normal tracking', async () => {
        await bookingCard(page).getByRole('button', { name: 'Annuler la réservation' }).click()
        await expect(bookingCard(page)).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Déclarer une réservation' })).toBeVisible()

        await page.goto('/')
        await expect(page.getByText('0/6 réservés')).toBeVisible()
        await expect(firstTrip(page).getByRole('region', { name: /^Aller/ })).not.toContainText('Réservé')
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the trains of a leg refuse a signed-out caller', async ({ request }) => {
  const response = await request.get('/api/trips/2026-W43/legs/outbound/trains')

  expect(response.status()).toBe(401)
})
