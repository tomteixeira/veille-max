import { expect, test, type Page } from '@playwright/test'
import type { Weekday } from '../../shared/domain/trip-template'
import { addDays, longDayName, parisDate } from '../../shared/utils/paris-time'
import { saveBooking, saveTripTemplate, withSnapshots, type FixtureTrain } from './support/snapshots'
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

      const curve = card(page, 'Sorties de places')
      const slots = card(page, 'Créneaux')
      const lifetimes = card(page, 'Durée de vie')

      await test.step('by default, the three charts count the trip weekdays only, since the first snapshot', async () => {
        await expect(page.getByText('Vos routes · depuis le 1 janv.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Vendredi & dimanche' })).toHaveAttribute('aria-pressed', 'true')

        await expect(curve.getByRole('heading')).toHaveText('Les places sortent surtout à J-8.')
        await expect(curve.getByRole('button', { name: /^J-\d+ :/ })).toHaveCount(31)

        await expect(slots.getByRole('heading')).toHaveText('Meilleur créneau : le vendredi de 11 h à 14 h, où 75 % des trains ont une place.')
        await expect(slots.getByRole('rowheader')).toHaveText(['Ven', 'Dim'])

        await expect(lifetimes.getByRole('heading')).toHaveText('100 % des places ont disparu dès le lendemain matin.')
        await expect(lifetimes.getByRole('listitem')).toHaveCount(5)
      })

      await test.step('tapping a column shows its value', async () => {
        await curve.getByRole('button', { name: 'J-8 : 2 places' }).click()
        await expect(curve.getByRole('status')).toHaveText('J-8 · 2 places')
      })

      await test.step('every day counts the other weekdays too', async () => {
        await page.getByRole('button', { name: 'Tous les jours' }).click()

        await expect(curve.getByRole('heading')).toHaveText('Les places sortent en deux vagues : J-8 et J-5.')
        await expect(slots.getByRole('rowheader')).toHaveText(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'])
        await expect(lifetimes.getByRole('heading')).toHaveText('67 % des places ont disparu dès le lendemain matin.')
      })
    })
  }
  finally {
    await removeTraveller(email)
  }
})

function isoWeekday(date: string): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1) as Weekday
}

/** The name of a leg's history chip, « Aller · Ven 23 oct. », by its leg and day of month. */
function legChip(leg: 'Aller' | 'Retour', date: string): RegExp {
  return new RegExp(`^${leg} · \\S+ ${Number(date.slice(8))} `)
}

/** « 2026-W43 »: the key of the trip whose outbound leg leaves on `date`. */
function tripKey(date: string): string {
  const thursday = new Date(`${addDays(date, 4 - isoWeekday(date))}T00:00:00Z`)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * 24 * 3600 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

test('the dashboard replays a leg’s history, of a tracked or an archived trip, and counts the bookings held', async ({ page, request }) => {
  // Routes no other test uses. The next trip leaves in 3 days and comes back in 5, whatever today is;
  // the previous one came back 2 days ago, on the day of the first snapshot.
  const bordeauxToMontpellier = { originCode: 'FRBOJ', destinationCode: 'FRMPL' }
  const montpellierToBordeaux = { originCode: 'FRMPL', destinationCode: 'FRBOJ' }
  const today = parisDate(new Date())
  const [outboundDate, returnDate, previousReturnDate] = [addDays(today, 3), addDays(today, 5), addDays(today, -2)]
  const train = (trainNumber: string, route: typeof bordeauxToMontpellier, date: string, departureTime: string, arrivalTime: string, open: boolean): FixtureTrain =>
    ({ trainNumber, ...route, date, departureTime, arrivalTime, open })
  // Arrives right at the ideal time; the later one arrives after the window.
  const ideal = (open: boolean) => train('4651', bordeauxToMontpellier, outboundDate, '07:00', '11:00', open)
  const late = (open: boolean) => train('4653', bordeauxToMontpellier, outboundDate, '08:30', '12:30', open)
  const back = (open: boolean) => train('4672', montpellierToBordeaux, returnDate, '17:00', '21:00', open)
  const previousBack = (open: boolean) => train('4670', montpellierToBordeaux, previousReturnDate, '17:00', '21:00', open)

  /** Three morning snapshots: two days ago, yesterday and today. */
  const history = [
    { takenAt: new Date(`${addDays(today, -2)}T04:24:00Z`), trains: [ideal(true), late(false), back(false), previousBack(false)] },
    { takenAt: new Date(`${addDays(today, -1)}T04:24:00Z`), trains: [ideal(true), late(true), back(false)] },
    { takenAt: new Date(`${today}T04:24:00Z`), trains: [ideal(true), late(false), back(true)] },
  ]

  const email = `historique-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)
  await saveTripTemplate(travellerId, {
    outbound: { weekday: isoWeekday(outboundDate), anchor: 'arrival', window: { start: null, end: '12:00' }, idealTime: '11:00', routes: [bordeauxToMontpellier] },
    return: { weekday: isoWeekday(returnDate), anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [montpellierToBordeaux] },
  })

  try {
    await withSnapshots(history, async () => {
      // Two bookings held, declared today (D-3 and D-5); one of the previous trip, declared at D-7.
      await saveBooking(travellerId, { tripKey: tripKey(outboundDate), legKind: 'outbound', train: ideal(true) })
      await saveBooking(travellerId, { tripKey: tripKey(outboundDate), legKind: 'return', train: back(true) })
      await saveBooking(travellerId, { tripKey: tripKey(addDays(outboundDate, -7)), legKind: 'return', train: previousBack(false), bookedAt: new Date(`${addDays(previousReturnDate, -7)}T10:00:00Z`) })

      await signInThroughTheApp(page, request, email)
      await page.goto('/dashboard')

      const bookings = page.getByRole('region', { name: 'Réservations' })
      const legHistory = card(page, 'Historique d’un trajet')

      await test.step('the bookings card counts the bookings held, and when the traveller usually books', async () => {
        await expect(bookings).toContainText('2/6')
        await expect(bookings).toContainText('Vous réservez en moyenne à J-5.')
        await expect(bookings.getByRole('listitem')).toHaveCount(1)
        await expect(bookings.getByRole('listitem')).toContainText('Réservé à J-7')
      })

      await test.step('the next leg to leave is picked by default, with one column per snapshot', async () => {
        await expect(legHistory.getByRole('button', { name: legChip('Aller', outboundDate) })).toHaveAttribute('aria-pressed', 'true')
        await expect(legHistory.getByRole('heading')).toHaveText(`Aller du ${longDayName(outboundDate).toLowerCase()} : 1 train au dernier instantané.`)
        await expect(legHistory).toContainText('Arrivée avant 12:00 · idéale 11:00')
        await expect(legHistory.getByRole('button', { name: /^J-\d+ :/ })).toHaveCount(3)
        for (const name of ['J-5 : 1 train', 'J-4 : 2 trains', 'J-3 : 1 train']) await expect(legHistory.getByRole('button', { name })).toBeVisible()
      })

      await test.step('tapping a column shows its best candidate', async () => {
        await legHistory.getByRole('button', { name: 'J-4 : 2 trains' }).click()

        await expect(legHistory.getByRole('status')).toContainText('J-4 · 2 trains')
        await expect(legHistory.getByRole('status')).toContainText('07:00 → 11:00')
        await expect(legHistory.getByRole('status')).toContainText('Bordeaux St-Jean → Montpellier St-Roch')
      })

      await test.step('another leg shows its own history', async () => {
        await legHistory.getByRole('button', { name: legChip('Retour', returnDate) }).click()

        await expect(legHistory.getByRole('heading')).toHaveText(`Retour du ${longDayName(returnDate).toLowerCase()} : 1 train au dernier instantané.`)
        await expect(legHistory.getByRole('button', { name: 'J-7 : aucun train' })).toBeVisible()
      })

      await test.step('a leg of an archived trip keeps its history', async () => {
        await legHistory.getByRole('button', { name: legChip('Retour', previousReturnDate) }).click()

        await expect(legHistory.getByRole('heading')).toHaveText(`Retour du ${longDayName(previousReturnDate).toLowerCase()} : aucun train n’a eu de place.`)
        // Its only snapshot was taken on its departure day.
        await expect(legHistory.getByRole('button', { name: /^(J-\d+|Départ) :/ })).toHaveCount(1)
        await expect(legHistory.getByRole('button', { name: 'Départ : aucun train' })).toBeVisible()
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
