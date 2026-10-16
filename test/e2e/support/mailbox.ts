import { expect, type APIRequestContext } from '@playwright/test'

/**
 * The local mail catcher (Mailpit) that receives every email the local
 * Supabase stack sends. Port from `[local_smtp]` in `supabase/config.toml`.
 */
const MAILPIT_URL = 'http://127.0.0.1:56324'

export interface ReceivedEmail {
  subject: string
  text: string
  html: string
}

function recipientQuery(address: string): string {
  return new URLSearchParams({ query: `to:"${address}"` }).toString()
}

/** Forgets every email sent to `address`, so the next one read is fresh. */
export async function clearMailbox(request: APIRequestContext, address: string): Promise<void> {
  const response = await request.delete(`${MAILPIT_URL}/api/v1/search?${recipientQuery(address)}`)
  expect(response.ok(), `Mailpit at ${MAILPIT_URL} must be running`).toBe(true)
}

/** Waits for the latest email sent to `address` and returns it. */
export async function readLatestEmail(request: APIRequestContext, address: string): Promise<ReceivedEmail> {
  let id: string | undefined
  await expect.poll(async () => {
    const response = await request.get(`${MAILPIT_URL}/api/v1/search?${recipientQuery(address)}&limit=1`)
    const { messages } = await response.json() as { messages: { ID: string }[] }
    id = messages[0]?.ID
    return id
  }, { message: `an email to ${address}`, timeout: 10_000 }).toBeTruthy()

  const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json() as {
    Subject: string
    Text: string
    HTML: string
  }
  return { subject: message.Subject, text: message.Text, html: message.HTML }
}

/** Counts the emails sent to `address`. */
export async function countEmails(request: APIRequestContext, address: string): Promise<number> {
  const response = await request.get(`${MAILPIT_URL}/api/v1/search?${recipientQuery(address)}`)
  const { messages_count: count } = await response.json() as { messages_count: number }
  return count
}
