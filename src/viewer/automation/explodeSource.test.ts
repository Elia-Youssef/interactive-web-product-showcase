import { expect, test } from 'vitest'
import { clearExplodeReading, readExplode, setExplodeReading } from './explodeSource'
import type { ViewerExplode } from './viewerAutomation'

// One owner per test: the registry is keyed by the owner, so cases must not
// reach each other through a shared key.
function owner(): object {
  return {}
}

function readingOf(t: number): ViewerExplode {
  return { t, target: t, moving: false, parts: {} }
}

test('a registered reading answers the hook until it is cleared', () => {
  const one = owner()
  const reading = () => readingOf(0.25)
  setExplodeReading(one, reading)

  expect(readExplode(one)?.t).toBe(0.25)

  clearExplodeReading(one, reading)

  expect(readExplode(one)).toBeNull()
})

test('an owner without a reading answers null', () => {
  expect(readExplode(owner())).toBeNull()
})

test('a second registration over a live one fails loudly', () => {
  const one = owner()
  const reading = () => readingOf(0)
  setExplodeReading(one, reading)

  expect(() => setExplodeReading(one, () => readingOf(1))).toThrowError(/already registered/)

  clearExplodeReading(one, reading)
})

test('a stale cleanup cannot clear the reading its owner holds now', () => {
  const one = owner()
  const reading = () => readingOf(0)
  setExplodeReading(one, reading)

  // A function the owner never registered, as an unmounting stale cleanup
  // would hand over.
  expect(() => clearExplodeReading(one, () => readingOf(0))).toThrowError(/stale explode reading/)
  expect(readExplode(one)).not.toBeNull()

  clearExplodeReading(one, reading)
})

test('a reading that reports null reaches the hook as null', () => {
  const one = owner()
  const reading: Parameters<typeof setExplodeReading>[1] = () => null
  setExplodeReading(one, reading)

  expect(readExplode(one)).toBeNull()

  clearExplodeReading(one, reading)
})
