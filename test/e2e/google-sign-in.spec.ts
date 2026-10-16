import { expect, test } from '@playwright/test'
import { INVITED_TRAVELLER_STATE } from './support/travellers'

// Real Google is not automated (ticket 13): these tests stop at the redirect to Google, and
// stand in for Supabase when it sends the traveller back to the app.

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('« Continuer avec Google » leaves the page for Google, through Supabase, with PKCE and a callback inside the app', async ({ page, baseURL }) => {
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL!
    // Supabase answers for real; the page stops at its redirect, so that Google is never reached.
    // (Playwright cannot intercept the Google hop itself: routes only see a redirect's first URL.)
    let googleUrl: URL | undefined
    await page.route(`${supabaseUrl}/auth/v1/authorize?*`, async (route) => {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(302)
      googleUrl = new URL(response.headers().location!)
      await route.fulfill({ contentType: 'text/html', body: '<title>Google</title>' })
    })

    await page.goto('/login')
    const authorize = page.waitForRequest(request => request.url().startsWith(`${supabaseUrl}/auth/v1/authorize`))
    await page.getByRole('button', { name: 'Continuer avec Google' }).click()

    await test.step('the app asks Supabase for the Google provider, with a PKCE challenge, back to /confirm', async () => {
      const request = await authorize
      // A full-page navigation, not a popup or a background request.
      expect(request.isNavigationRequest()).toBe(true)
      expect(request.frame()).toBe(page.mainFrame())
      const params = new URL(request.url()).searchParams
      expect(params.get('provider')).toBe('google')
      expect(params.get('redirect_to')).toBe(`${baseURL}/confirm`)
      expect(params.get('code_challenge')).toBeTruthy()
      expect(params.get('code_challenge_method')).toBe('s256')
      await expect(page).toHaveTitle('Google')
    })

    await test.step('Supabase sends the page on to Google, which answers to Supabase', async () => {
      expect(googleUrl?.origin).toBe('https://accounts.google.com')
      const params = googleUrl!.searchParams
      expect(params.get('redirect_uri')).toBe(`${supabaseUrl}/auth/v1/callback`)
      expect(params.get('response_type')).toBe('code')
      expect(params.get('scope')).toContain('email')
      // The traveller picks the account, rather than Google reusing the last one.
      expect(params.get('prompt')).toBe('select_account')
    })
  })

  test('a Google account that is not an invited traveller is refused with a clear message', async ({ page }) => {
    // What Supabase sends back while sign-ups are closed, for a Google account it does not know.
    await page.goto('/confirm?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance')

    await expect(page).toHaveTitle('Connexion · Veille MAX')
    await expect(page.getByRole('alert')).toHaveText(
      'Ce compte Google n’a pas accès à Veille MAX. Connectez-vous avec l’adresse de votre invitation, ou recevez un code par e-mail.',
    )
    await page.getByRole('link', { name: 'Retour à la connexion' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('a Google sign-in that did not finish says so', async ({ page }) => {
    // The traveller closed Google's consent screen.
    await page.goto('/confirm?error=access_denied&error_description=The+user+denied+the+request')

    await expect(page.getByRole('alert')).toHaveText('La connexion avec Google n’a pas abouti. Réessayez, ou recevez un code par e-mail.')
  })

  test('a code this browser cannot trade for a session says the sign-in did not finish', async ({ page }) => {
    // The sign-in started in another browser (e.g. Safari rather than the installed app), so the
    // PKCE verifier is not here.
    await page.goto('/confirm?code=00000000-0000-0000-0000-000000000000')

    await expect(page.getByRole('alert')).toHaveText('La connexion avec Google n’a pas abouti. Réessayez, ou recevez un code par e-mail.')
  })

  test('a callback without a Google answer goes back to sign-in', async ({ page }) => {
    await page.goto('/confirm')
    await expect(page).toHaveURL('/login')
  })
})

test.describe('signed in', () => {
  test.use({ storageState: INVITED_TRAVELLER_STATE })

  test('once signed in, the callback lands on the home page', async ({ page }) => {
    await page.goto('/confirm')
    await expect(page).toHaveURL('/')
  })

  test('once signed in, the callback lands on the page the traveller asked for before signing in', async ({ page, baseURL }) => {
    // The cookie the sign-in redirect leaves for a signed-out visit to Réglages. It is named after
    // the auth cookie (which may be split in chunks: `….0`, `….1`).
    const { cookies } = await page.context().storageState()
    const authCookie = cookies.find(cookie => /-auth-token(\.\d+)?$/.test(cookie.name))
    expect(authCookie).toBeDefined()
    const redirectCookie = `${authCookie!.name.replace(/\.\d+$/, '')}-redirect-path`
    await page.context().addCookies([{ name: redirectCookie, value: encodeURIComponent('/settings'), url: baseURL! }])

    await page.goto('/confirm')
    await expect(page).toHaveURL('/settings')
  })
})
