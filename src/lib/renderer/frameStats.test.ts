import { expect, test } from 'vitest'
import { frameRateMaxHz, frameRecordCapacity, frameStats, frameWindowMs } from './frameStats'
import { FrameRing } from './frameRing'
import type { FrameRecord } from './frameStats'

function record(atMs: number, tickMs: number): FrameRecord {
  return { atMs, tickMs }
}

test('the ring capacity is derived from the window and the maximum rate', () => {
  expect(frameRecordCapacity).toBe(Math.ceil((frameWindowMs / 1000) * frameRateMaxHz))
})

test('a rate at the maximum is counted in full', () => {
  const capacity = frameRecordCapacity
  const spacingMs = frameWindowMs / frameRateMaxHz
  const records = Array.from({ length: frameRateMaxHz }, (_, index) => record(index * spacingMs, 1))

  // The ring holds every frame of the maximum rate in the window.
  const ring = new FrameRing(capacity)
  for (const frame of records) {
    ring.push(frame.atMs, frame.tickMs)
  }
  expect(ring.records()).toHaveLength(frameRateMaxHz)

  const stats = frameStats(records, frameWindowMs)
  expect(stats.fps).toBe(frameRateMaxHz)
})

test('an empty window reports zero fps and no mean duration', () => {
  const stats = frameStats([], 5000)

  expect(stats.fps).toBe(0)
  expect(stats.meanTickMs).toBeNull()
})

test('a steady rate counts the frames inside the window', () => {
  const records = Array.from({ length: 60 }, (_, index) => record(index * (1000 / 60), 2))

  const stats = frameStats(records, 1000)

  expect(stats.fps).toBeCloseTo(60, 10)
  expect(stats.meanTickMs).toBeCloseTo(2, 10)
})

test('a burst followed by rest falls to zero fps once the window passes', () => {
  const records = Array.from({ length: 90 }, (_, index) => record(index * 5, 1))
  const lastAtMs = 89 * 5

  // Just inside the window the newest frame of the burst still counts.
  const during = frameStats(records, lastAtMs + frameWindowMs)
  expect(during.fps).toBeGreaterThan(0)

  // One millisecond later every frame of the burst has aged out.
  const after = frameStats(records, lastAtMs + frameWindowMs + 1)
  expect(after.fps).toBe(0)
  expect(after.meanTickMs).toBeNull()
})

test('frames older than the window do not count toward a fresh burst', () => {
  const old = Array.from({ length: 30 }, (_, index) => record(index, 1))
  const fresh = [record(10000, 4)]

  const stats = frameStats([...old, ...fresh], 10500)

  expect(stats.fps).toBeCloseTo(fresh.length / (frameWindowMs / 1000), 10)
  expect(stats.meanTickMs).toBeCloseTo(4, 10)
})

test('the mean duration is exact over unequal frames, without rounding', () => {
  const records = [record(0, 1), record(10, 2), record(20, 4)]

  const stats = frameStats(records, frameWindowMs)

  expect(stats.meanTickMs).toBeCloseTo(7 / 3, 12)
  expect(stats.fps).toBeCloseTo(3 / (frameWindowMs / 1000), 12)
})

test('a full ring keeps the newest records and drops the oldest', () => {
  const ring = new FrameRing(4)
  for (let index = 0; index < 6; index += 1) {
    ring.push(index * 10, index)
  }

  expect(ring.records()).toEqual([record(20, 2), record(30, 3), record(40, 4), record(50, 5)])
})

test('a ring read does not alias the slots the writer reuses', () => {
  const ring = new FrameRing(2)
  ring.push(0, 1)
  const sample = ring.records()
  ring.push(100, 2)

  expect(sample).toEqual([record(0, 1)])
})

test('a ring capacity below one fails loudly', () => {
  expect(() => new FrameRing(0)).toThrow(/capacity/)
})

test('the default capacity comes from the window constant', () => {
  const ring = new FrameRing()
  for (let index = 0; index < frameRecordCapacity + 10; index += 1) {
    ring.push(index, 1)
  }

  expect(ring.records()).toHaveLength(frameRecordCapacity)
})
