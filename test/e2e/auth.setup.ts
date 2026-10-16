import { test as setup } from '@playwright/test'
import { INVITED_TRAVELLER_EMAIL, INVITED_TRAVELLER_STATE, signInThroughTheApp } from './support/travellers'

// Signs the invited traveller in once; the other tests start from this browser state.
setup('sign the invited traveller in', async ({ page, request }) => {
  await signInThroughTheApp(page, request, INVITED_TRAVELLER_EMAIL)
  await page.context().storageState({ path: INVITED_TRAVELLER_STATE })
})
