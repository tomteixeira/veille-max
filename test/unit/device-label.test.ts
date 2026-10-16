import { describe, expect, it } from 'vitest'
import { deviceLabel, onThisDevice } from '../../app/utils/device-label'

const userAgents = {
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ presents itself as a Mac; only its touch screen tells them apart.
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 16181.61.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
}

describe('the label of a device', () => {
  it.each([
    ['an iPhone', userAgents.iPhone, 5, 'iPhone'],
    ['an iPad', userAgents.iPad, 5, 'iPad'],
    ['an iPad presenting itself as a Mac', userAgents.mac, 5, 'iPad'],
    ['a Mac', userAgents.mac, 0, 'Mac'],
    ['an Android phone', userAgents.android, 5, 'Android'],
    ['a Windows PC', userAgents.windows, 0, 'PC Windows'],
    ['a Chromebook', userAgents.chromebook, 0, 'Chromebook'],
    ['a Linux computer', userAgents.linux, 0, 'Linux'],
    ['anything else', 'Mozilla/5.0 (PlayStation; PlayStation 5/2.26)', 0, 'Appareil'],
  ])('names %s', (_, userAgent, maxTouchPoints, label) => {
    expect(deviceLabel({ userAgent, maxTouchPoints })).toBe(label)
  })
})

describe('naming the device in use', () => {
  it.each([
    ['iPhone', 'cet iPhone'],
    ['iPad', 'cet iPad'],
    ['Mac', 'ce Mac'],
    ['Android', 'cet appareil Android'],
    ['PC Windows', 'ce PC Windows'],
    ['Chromebook', 'ce Chromebook'],
    ['Linux', 'cet ordinateur Linux'],
    ['Appareil', 'cet appareil'],
  ])('says « %s » as « %s »', (label, words) => {
    expect(onThisDevice(label)).toBe(words)
  })
})
