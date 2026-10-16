import { describe, expect, it } from 'vitest'
import { addRoute, defaultTripTemplate, moveRoute, removeRoute, routeProblem, type Route } from '#shared/domain/trip-template'

const parisLyonToPartDieu: Route = { originCode: 'FRPLY', destinationCode: 'FRLPD' }
const parisLyonToPerrache: Route = { originCode: 'FRPLY', destinationCode: 'FRLPE' }
const parisBercyToPartDieu: Route = { originCode: 'FRPBE', destinationCode: 'FRLPD' }

describe('trip template', () => {
  it('starts a new traveller with a Friday outbound leg, a Sunday return leg and no routes', () => {
    const template = defaultTripTemplate()

    expect(template.outbound.weekday).toBe(5)
    expect(template.return.weekday).toBe(7)
    expect(template.outbound.routes).toEqual([])
    expect(template.return.routes).toEqual([])
  })

  describe('ranked routes of a leg', () => {
    it('ranks an added route after the routes already there', () => {
      const routes = addRoute(addRoute(defaultTripTemplate().outbound.routes, parisLyonToPartDieu), parisLyonToPerrache)

      expect(routes).toEqual([parisLyonToPartDieu, parisLyonToPerrache])
    })

    it('refuses a route the leg already ranks', () => {
      const routes = [parisLyonToPartDieu]
      const sameRoute = { originCode: 'FRPLY', destinationCode: 'FRLPD' }

      expect(routeProblem(routes, sameRoute)).toBe('already-ranked')
      expect(() => addRoute(routes, sameRoute)).toThrow()
      expect(routeProblem(routes, { originCode: 'FRLPD', destinationCode: 'FRPLY' })).toBeNull()
    })

    it('refuses a route from a station to itself', () => {
      const loop = { originCode: 'FRLPD', destinationCode: 'FRLPD' }

      expect(routeProblem([], loop)).toBe('same-station')
      expect(() => addRoute([], loop)).toThrow()
    })

    it('moves a route up or down one rank, swapping it with its neighbour', () => {
      const routes = [parisLyonToPartDieu, parisLyonToPerrache, parisBercyToPartDieu]

      expect(moveRoute(routes, 3, 'up')).toEqual([parisLyonToPartDieu, parisBercyToPartDieu, parisLyonToPerrache])
      expect(moveRoute(routes, 1, 'down')).toEqual([parisLyonToPerrache, parisLyonToPartDieu, parisBercyToPartDieu])
    })

    it('keeps the first route first and the last route last', () => {
      const routes = [parisLyonToPartDieu, parisLyonToPerrache]

      expect(moveRoute(routes, 1, 'up')).toEqual([parisLyonToPartDieu, parisLyonToPerrache])
      expect(moveRoute(routes, 2, 'down')).toEqual([parisLyonToPartDieu, parisLyonToPerrache])
    })

    it('moves the routes below a removed route up one rank', () => {
      const routes = [parisLyonToPartDieu, parisLyonToPerrache, parisBercyToPartDieu]

      expect(removeRoute(routes, 1)).toEqual([parisLyonToPerrache, parisBercyToPartDieu])
      expect(removeRoute(routes, 3)).toEqual([parisLyonToPartDieu, parisLyonToPerrache])
    })

    it('accepts again a route once it was removed', () => {
      const routes = removeRoute([parisLyonToPartDieu], 1)

      expect(routeProblem(routes, parisLyonToPartDieu)).toBeNull()
    })
  })
})
