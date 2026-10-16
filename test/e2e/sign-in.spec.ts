import { expect, test } from '@playwright/test'
import { clearMailbox, countEmails, readLatestEmail } from './support/mailbox'
import { hasAccount, INVITED_TRAVELLER_EMAIL, INVITED_TRAVELLER_STATE, signInCodeFrom } from './support/travellers'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('every page except sign-in sends a signed-out visitor to sign-in', async ({ page }) => {
    for (const path of ['/', '/dashboard', '/settings']) {
      await page.goto(path)
      await expect(page).toHaveURL('/login')
    }
    await expect(page).toHaveTitle('Connexion · Veille MAX')
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0)
    await expect(page.getByText('Veille MAX n’est pas affilié à SNCF Voyageurs')).toBeVisible()
  })

  // One journey, so that signing out ends a session no other test shares.
  test('an invited traveller signs in with the 6-digit code received by email, stays signed in, then signs out', async ({ page, request, browser }) => {
    let code = ''

    await test.step('the traveller asks for a code from the page they wanted', async () => {
      await clearMailbox(request, INVITED_TRAVELLER_EMAIL)
      await page.goto('/dashboard')
      await expect(page).toHaveURL('/login')

      await page.getByLabel('Adresse e-mail').fill(INVITED_TRAVELLER_EMAIL)
      await page.getByRole('button', { name: 'Recevoir un code' }).click()
      await expect(page.getByText(`Code envoyé à ${INVITED_TRAVELLER_EMAIL}`)).toBeVisible()
    })

    await test.step('the email carries the code, not a magic link', async () => {
      // A link would open in Safari, outside the installed app.
      const email = await readLatestEmail(request, INVITED_TRAVELLER_EMAIL)
      code = signInCodeFrom(email)
      expect(email.html).not.toContain('href=')
      expect(email.text).not.toMatch(/https?:\/\//)
    })

    await test.step('a wrong code is refused', async () => {
      const wrongCode = code.replace(/\d$/, digit => String((Number(digit) + 1) % 10))
      await page.getByLabel('Code à 6 chiffres').fill(wrongCode)
      await expect(page.getByRole('alert')).toHaveText('Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.')
    })

    await test.step('the right code signs the traveller in, on the page they wanted', async () => {
      await page.getByLabel('Code à 6 chiffres').fill(code)
      await expect(page).toHaveURL('/dashboard')
      await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    })

    const reopened = await test.step('the sign-in survives closing and reopening the app', async () => {
      // Reopened a year later, the app only has the cookies that last that long: closing it drops
      // the session cookies, and the shorter-lived ones have expired.
      const { cookies, origins } = await page.context().storageState()
      const kept = cookies.filter(cookie => cookie.expires * 1000 > Date.now() + ONE_YEAR_MS)
      await page.context().close()

      const context = await browser.newContext({ storageState: { cookies: kept, origins } })
      const reopenedPage = await context.newPage()
      await reopenedPage.goto('/settings')
      await expect(reopenedPage).toHaveURL('/settings')
      return reopenedPage
    })

    await test.step('Réglages shows the signed-in email, and signing out returns to sign-in', async () => {
      const account = reopened.getByRole('region', { name: 'Compte et application' })
      await expect(account).toContainText(INVITED_TRAVELLER_EMAIL)

      await account.getByRole('button', { name: 'Se déconnecter' }).click()
      await expect(reopened).toHaveURL('/login')

      await reopened.goto('/settings')
      await expect(reopened).toHaveURL('/login')
      await reopened.context().close()
    })
  })

  test('an uninvited email is refused with a neutral message and no account is created', async ({ page, request }) => {
    const stranger = 'inconnu@veille-max.test'
    await clearMailbox(request, stranger)
    await page.goto('/login')

    await page.getByLabel('Adresse e-mail').fill(stranger)
    await page.getByRole('button', { name: 'Recevoir un code' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Cette adresse n’a pas accès à Veille MAX. Si vous avez reçu une invitation, ouvrez d’abord son lien, puis réessayez.',
    )
    await expect(page.getByLabel('Code à 6 chiffres')).toHaveCount(0)
    expect(await countEmails(request, stranger)).toBe(0)
    expect(await hasAccount(stranger)).toBe(false)
  })
})

test.describe('signed in', () => {
  test.use({ storageState: INVITED_TRAVELLER_STATE })

  test('the sign-in screen sends a signed-in traveller home', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/')
  })
})
