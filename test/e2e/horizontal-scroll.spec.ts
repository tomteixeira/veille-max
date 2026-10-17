import { expect, test, type Page } from '@playwright/test'
import { saveTripTemplate } from './support/snapshots'
import { inviteTraveller, removeTraveller, signInThroughTheApp } from './support/travellers'

test.use({ viewport: { width: 375, height: 812 }, storageState: { cookies: [], origins: [] } })

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({ width: 375, scrollWidth: 375 })
}

// Chromium’s mobile project: send a real touch gesture rather than a synthetic DOM event.
async function swipe(page: Page, from: number, to: number, y: number) {
  const touch = await page.context().newCDPSession(page)
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
    for (let step = 1; step <= 10; step++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * step / 10, y }] })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  finally {
    await touch.detach()
  }
}

test('mobile pages stay within the viewport while the trip carousel scrolls independently', async ({ page, request }) => {
  const email = `horizontal-scroll-${Date.now()}@veille-max.test`
  const travellerId = await inviteTraveller(email)

  try {
    await signInThroughTheApp(page, request, email)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rien à surveiller')
    await expectNoPageOverflow(page)

    await saveTripTemplate(travellerId, {
      outbound: { weekday: 5, anchor: 'arrival', window: { start: null, end: '10:00' }, idealTime: '09:00', routes: [{ originCode: 'FRPLY', destinationCode: 'FRLPD' }] },
      return: { weekday: 7, anchor: 'departure', window: { start: '14:00', end: null }, idealTime: '17:00', routes: [{ originCode: 'FRLPD', destinationCode: 'FRPLY' }] },
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('sous surveillance')
    await expectNoPageOverflow(page)

    const carousel = page.getByRole('region', { name: 'Vos week-ends' }).locator(':scope > div')
    const tickets = carousel.getByRole('article')
    await expect.poll(() => tickets.count()).toBeGreaterThan(1)
    await carousel.evaluate(el => el.scrollTo({ left: 318 }))
    // The next card snaps to the same 24 px inset as the first card.
    await expect.poll(() => tickets.nth(1).evaluate(el => Math.round(el.getBoundingClientRect().left))).toBe(24)
    await expectNoPageOverflow(page)

    for (const end of ['last', 'first'] as const) {
      await carousel.evaluate((el, end) => el.scrollTo({ left: end === 'last' ? el.scrollWidth : 0 }), end)
      await expect.poll(() => carousel.evaluate((el, end) => Math.abs(el.scrollLeft - (end === 'last' ? el.scrollWidth - el.clientWidth : 0)) < 1, end)).toBe(true)
      const bounds = (await carousel.boundingBox())!
      await swipe(page, end === 'last' ? 300 : 75, end === 'last' ? 75 : 300, bounds.y + 40)
      await expectNoPageOverflow(page)
      expect(await page.evaluate(() => window.scrollX)).toBe(0)
    }

    await swipe(page, 300, 75, 100)
    await expectNoPageOverflow(page)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)

    // A normal tap remains accurate after interacting with the carousel.
    await tickets.first().getByRole('link', { name: /^Aller/ }).click()
    await expect(page).toHaveURL(/\/trips\/\d{4}-W\d{2}\/outbound$/)
    await expectNoPageOverflow(page)

    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    for (const name of ['Réglages', 'Dashboard']) {
      await nav.getByRole('link', { name }).click()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoPageOverflow(page)
    }
  }
  finally {
    await removeTraveller(email)
  }
})
