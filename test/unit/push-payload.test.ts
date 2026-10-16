import { describe, expect, it } from 'vitest'
import { notificationTarget, readPushMessage } from '../../service-worker/push-payload'

const scope = 'https://veille-max.example/'

describe('reading a push payload', () => {
  it('shows the title and body the server sent, and leads where it said', () => {
    const payload = JSON.stringify({ title: 'Aller · ven. 30 oct.', body: 'Paris → Lyon 07:04, mieux que votre réservation', url: '/trips/2026-W44/outbound' })

    expect(readPushMessage(payload)).toEqual({ title: 'Aller · ven. 30 oct.', body: 'Paris → Lyon 07:04, mieux que votre réservation', url: '/trips/2026-W44/outbound' })
  })

  it.each([
    ['no payload', null],
    ['a payload that is not JSON', 'Nouveau train'],
    ['a payload without a title', JSON.stringify({ body: 'Un train', url: '/' })],
    ['a JSON payload that is not an object', '42'],
  ])('still shows a notification for %s', (_, payload) => {
    expect(readPushMessage(payload)).toEqual({ title: 'Veille MAX', body: 'Ouvrez l’app pour voir les nouveautés.', url: '/' })
  })
})

describe('where tapping a notification leads', () => {
  it.each([
    ['a path inside the app', '/trips/2026-W44/outbound', 'https://veille-max.example/trips/2026-W44/outbound'],
    ['an address inside the app', 'https://veille-max.example/settings', 'https://veille-max.example/settings'],
    ['a path with a query', '/settings?from=push', 'https://veille-max.example/settings?from=push'],
  ])('opens %s', (_, url, expected) => {
    expect(notificationTarget(url, scope)).toBe(expected)
  })

  it.each([
    ['another site', 'https://www.sncf-connect.com/app/home/search'],
    ['a protocol-relative address', '//evil.example/settings'],
    ['a look-alike host', 'https://veille-max.example.evil.example/'],
    ['a script', 'javascript:alert(1)'],
    ['nothing', undefined],
    ['not a string', 42],
  ])('opens the app’s home instead of %s', (_, url) => {
    expect(notificationTarget(url, scope)).toBe(scope)
  })

  it('stays inside a scope narrower than the site', () => {
    expect(notificationTarget('/admin', 'https://veille-max.example/app/')).toBe('https://veille-max.example/app/')
    expect(notificationTarget('/app/settings', 'https://veille-max.example/app/')).toBe('https://veille-max.example/app/settings')
  })
})
