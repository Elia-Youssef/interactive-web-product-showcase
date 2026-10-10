import { describe, expect, it } from 'vitest'
import { degreesToRadians } from './limits'
import {
  addOrbitTurns,
  orbitTurnOf,
  steppedOrbit,
  tiltLimitOf,
  tiltStepMoves,
  type OrbitDirection,
} from './orbitStep'

const config = { rotateStepDegrees: 15, tiltStepDegrees: 12, fineStepDegrees: 5 }
const range = { min: degreesToRadians(15), max: degreesToRadians(165) }

describe('orbitTurnOf', () => {
  it.each<[OrbitDirection, number, number]>([
    ['left', 15, 0],
    ['right', -15, 0],
    ['up', 0, 12],
    ['down', 0, -12],
  ])('turns %s by the coarse step on its own axis', (direction, azimuth, polar) => {
    expect(orbitTurnOf(direction, 'coarse', config)).toEqual({
      azimuthDegrees: azimuth,
      polarDegrees: polar,
    })
  })

  it.each<[OrbitDirection, number, number]>([
    ['left', 5, 0],
    ['right', -5, 0],
    ['up', 0, 5],
    ['down', 0, -5],
  ])('turns %s by the fine step on its own axis', (direction, azimuth, polar) => {
    expect(orbitTurnOf(direction, 'fine', config)).toEqual({
      azimuthDegrees: azimuth,
      polarDegrees: polar,
    })
  })

  it('turns right with the sign of a right drag: the azimuth goes down', () => {
    const end = steppedOrbit(
      { azimuth: 1, polar: 1 },
      orbitTurnOf('right', 'coarse', config),
      range,
    )
    expect(end.azimuth).toBeLessThan(1)
  })
})

describe('addOrbitTurns', () => {
  it('adds both axes, so turns asked within one frame merge exactly', () => {
    const turns = [
      orbitTurnOf('right', 'coarse', config),
      orbitTurnOf('right', 'fine', config),
      orbitTurnOf('up', 'coarse', config),
    ]
    const merged = turns.reduce(addOrbitTurns)
    expect(merged).toEqual({ azimuthDegrees: -20, polarDegrees: 12 })
  })
})

describe('steppedOrbit', () => {
  it('adds the turn to the end angles in radians', () => {
    const end = steppedOrbit(
      { azimuth: 0.5, polar: 1 },
      { azimuthDegrees: 30, polarDegrees: -10 },
      range,
    )
    expect(end.azimuth).toBe(0.5 + degreesToRadians(30))
    expect(end.polar).toBe(1 + degreesToRadians(-10))
  })

  it('never bounds the azimuth: full turns accumulate', () => {
    const end = steppedOrbit(
      { azimuth: 0, polar: 1 },
      { azimuthDegrees: 720, polarDegrees: 0 },
      range,
    )
    expect(end.azimuth).toBe(degreesToRadians(720))
  })

  it('clamps the polar angle exactly at both limits', () => {
    const top = steppedOrbit(
      { azimuth: 0, polar: range.min + 0.01 },
      { azimuthDegrees: 0, polarDegrees: -40 },
      range,
    )
    const bottom = steppedOrbit(
      { azimuth: 0, polar: range.max - 0.01 },
      { azimuthDegrees: 0, polarDegrees: 40 },
      range,
    )
    expect(top.polar).toBe(range.min)
    expect(bottom.polar).toBe(range.max)
  })

  it('stops cumulative steps on the limit and keeps them there', () => {
    let end = { azimuth: 0, polar: degreesToRadians(90) }
    const down = orbitTurnOf('down', 'coarse', config)
    for (let step = 0; step < 20; step += 1) {
      end = steppedOrbit(end, down, range)
    }
    expect(end.polar).toBe(range.min)
  })
})

describe('tiltStepMoves', () => {
  it('moves inside the range both ways', () => {
    expect(tiltStepMoves(1, range, 'up')).toBe(true)
    expect(tiltStepMoves(1, range, 'down')).toBe(true)
  })

  it('waits at the limit it reached, and only that one', () => {
    expect(tiltStepMoves(range.max, range, 'up')).toBe(false)
    expect(tiltStepMoves(range.max, range, 'down')).toBe(true)
    expect(tiltStepMoves(range.min, range, 'down')).toBe(false)
    expect(tiltStepMoves(range.min, range, 'up')).toBe(true)
  })
})

describe('tiltLimitOf', () => {
  it('names the top view at the minimum and the bottom view at the maximum', () => {
    expect(tiltLimitOf(range.min, range)).toBe('top')
    expect(tiltLimitOf(range.max, range)).toBe('bottom')
    expect(tiltLimitOf(1, range)).toBeNull()
  })
})
