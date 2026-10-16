import { expect, test } from '@playwright/test'
import { addDays, parisDate } from '../../shared/utils/paris-time'
import { saveBooking, withLatestSnapshot, type FixtureTrain } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

// A traveller of their own, since they hold bookings and change their settings: they start signed out.
test.use({ storageState: { cookies: [], origins: [] } })

test('« Trajets à confirmer » lists the legs booked for tomorrow, with the button to confirm them on MAX JEUNE', async ({ page, request }) => {
  const tomorrow = addDays(parisDate(new Date()), 1)
  const tomorrowTrain: FixtureTrain = { date: tomorrow, trainNumber: '9931', originCode: 'FRPLY', destinationCode: 'FRLPD', departureTime: '07:00', arrivalTime: '08:56', open: true }
  const laterTrain: FixtureTrain = { ...tomorrowTrain, date: addDays(tomorrow, 2), trainNumber: '9980', originCode: 'FRLPD', destinationCode: 'FRPLY', departureTime: '17:04', arrivalTime: '19:00' }

  const email = `confirmation-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  try {
    await withLatestSnapshot([tomorrowTrain, laterTrain], async () => {
      await saveBooking(travellerId, { tripKey: '2026-W01', legKind: 'outbound', train: tomorrowTrain })
      await saveBooking(travellerId, { tripKey: '2026-W01', legKind: 'return', train: laterTrain })
      await signInThroughTheApp(page, request, email)

      await page.goto('/confirmations')

      await expect(page.getByRole('heading', { name: 'Trajets à confirmer' })).toBeVisible()
      const bookings = page.getByRole('region', { name: 'Réservations de demain' }).getByRole('article')
      await expect(bookings).toHaveCount(1)
      await expect(bookings).toContainText('Aller')
      await expect(bookings).toContainText('07:00 → 08:56')
      await expect(bookings).toContainText('Paris Gare de Lyon → Lyon Part-Dieu')
      await expect(bookings).toContainText('train 9931')
      await expect(page.getByText('17:00').first()).toBeVisible()

      const confirm = page.getByRole('link', { name: 'Confirmer sur MAX JEUNE' })
      await expect(confirm).toHaveAttribute('href', 'https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages')
      await expect(confirm).toHaveAttribute('target', '_blank')
    })
  }
  finally {
    await removeTraveller(email)
  }
})

test('the Confirmation Reminder is on by default and can be turned off in Réglages', async ({ page, request }) => {
  const email = `rappel-${Date.now()}@veille-max.test`
  await inviteTraveller(email)

  try {
    await signInThroughTheApp(page, request, email)
    await page.goto('/settings')
    const reminder = page.getByRole('region', { name: 'Notifications' }).getByRole('switch', { name: 'Rappel de confirmation' })

    await expect(reminder).toBeChecked()
    await expect(reminder).toBeEnabled()
    await reminder.click()
    await expect(reminder).not.toBeChecked()

    await page.reload()
    await expect(reminder).not.toBeChecked()
  }
  finally {
    await removeTraveller(email)
  }
})
