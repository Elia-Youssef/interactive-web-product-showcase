import { expect, test } from 'vitest'
import { createExplodeDriver, type ExplodeDriver } from './explodeDriver'
import type { ExplodePose } from './explodePose'

// The settings under the tests are the feature's own, so the explicit times
// read in real units: a full move settles in 0.8 s (explodeSpring).
//
// The fake pose records every write, so the tests can tell an applied pose
// from a skipped one and pin exactly when the progress moved.

function fakePose(): ExplodePose & { written: number[]; disposed: boolean } {
  const written: number[] = []
  return {
    written,
    disposed: false,
    apply(t) {
      written.push(t)
    },
    dispose() {
      this.disposed = true
    },
  }
}

function started(): { driver: ExplodeDriver; pose: ReturnType<typeof fakePose> } {
  const pose = fakePose()
  return { driver: createExplodeDriver(pose, 1000), pose }
}

test('a new driver starts at rest on the assembled pose', () => {
  const { driver, pose } = started()

  expect(pose.written).toEqual([0])
  expect(driver.appliedProgress()).toBe(0)
  expect(driver.moving()).toBe(false)
})

test('a frame at zero elapsed time right after a retarget still owes the next frame', () => {
  const { driver, pose } = started()

  expect(driver.retarget(1, 2000, false)).toBe(true)

  // The same tick as the retarget: no movement landed, the write is
  // skipped, and the move is still owed.
  expect(driver.step(2000)).toBe(true)
  expect(pose.written).toEqual([0])
  expect(driver.moving()).toBe(true)

  // The next tick moves and the move completes at its settle time.
  expect(driver.step(2500)).toBe(true)
  expect(driver.appliedProgress()).toBeGreaterThan(0)
  expect(driver.step(2800)).toBe(false)
  expect(driver.appliedProgress()).toBe(1)
  expect(driver.moving()).toBe(false)
})

test('a frame at rest pays nothing and writes nothing', () => {
  const { driver, pose } = started()

  driver.retarget(1, 2000, false)
  driver.step(2800)
  const writes = pose.written.length

  expect(driver.step(5000)).toBe(false)
  expect(driver.step(9000)).toBe(false)
  expect(pose.written.length).toBe(writes)
  expect(driver.appliedProgress()).toBe(1)
})

test('a retarget mid-move carries the progress and closes onto the new target', () => {
  const { driver } = started()

  driver.retarget(1, 1000, false)
  driver.step(1400)
  const mid = driver.appliedProgress()
  expect(mid).toBeGreaterThan(0)
  expect(mid).toBeLessThan(1)

  // Reverse mid-move: the pose first catches up to where the spring already
  // is, then walks onto the new target without ever leaving [0, 1].
  expect(driver.retarget(0, 1500, false)).toBe(true)
  for (let nowMs = 1500; nowMs < 60_000; nowMs += 100) {
    const owed = driver.step(nowMs)
    const progress = driver.appliedProgress()
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
    if (!owed) {
      break
    }
  }
  expect(driver.appliedProgress()).toBe(0)
  expect(driver.moving()).toBe(false)
})

test('the reduced-motion jump owes exactly one frame', () => {
  const { driver, pose } = started()

  expect(driver.retarget(1, 2000, true)).toBe(true)
  expect(pose.written).toEqual([0, 1])
  expect(driver.appliedProgress()).toBe(1)
  expect(driver.moving()).toBe(true)

  expect(driver.step(2000)).toBe(false)
  expect(pose.written).toEqual([0, 1])
  expect(driver.moving()).toBe(false)
})

test('the reading reports the applied progress and the owed frames', () => {
  const { driver } = started()

  driver.retarget(1, 2000, false)
  expect(driver.appliedProgress()).toBe(0)
  expect(driver.moving()).toBe(true)

  driver.step(2800)
  expect(driver.appliedProgress()).toBe(1)
  expect(driver.moving()).toBe(false)
})

test('disposing the driver disposes the pose', () => {
  const { driver, pose } = started()

  driver.dispose()

  expect(pose.disposed).toBe(true)
})

test('a new subscriber is called at once with the current progress', () => {
  const { driver } = started()
  driver.retarget(1, 2000, false)
  driver.step(2500)
  const current = driver.appliedProgress()

  const received: number[] = []
  driver.subscribe((progress) => received.push(progress))

  expect(received).toEqual([current])
})

test('a listener runs after every applied change, and only then', () => {
  const { driver, pose } = started()
  const received: number[] = []
  driver.subscribe((progress) => received.push(progress))

  // The subscribe-time call holds the assembled pose; the retarget itself
  // applies nothing, so no listener call is owed by it.
  expect(received).toEqual([0])

  // A frame at rest applies nothing, owes nothing, and calls nobody.
  expect(driver.step(2000)).toBe(false)
  expect(received).toEqual([0])

  // Every write of the pose calls the listener with what landed.
  driver.retarget(1, 1500, false)
  driver.step(2500)
  expect(received.length).toBe(2)
  expect(received[1]).toBe(driver.appliedProgress())
  expect(received[1]).toBeGreaterThan(0)

  // Under reduced motion the jump applies the target directly, and the
  // listener runs with it, in the same synchronous call.
  driver.retarget(0, 2600, true)
  expect(received[received.length - 1]).toBe(0)
  expect(pose.written[pose.written.length - 1]).toBe(0)
})

test('several listeners each run once per applied change', () => {
  const { driver } = started()
  const first: number[] = []
  const second: number[] = []
  driver.subscribe((progress) => first.push(progress))
  driver.subscribe((progress) => second.push(progress))

  driver.retarget(1, 2000, true)

  expect(first).toEqual([0, 1])
  expect(second).toEqual([0, 1])
})

test('a stale subscription release throws', () => {
  const { driver } = started()
  const received: number[] = []
  const release = driver.subscribe((progress) => received.push(progress))

  release()
  driver.retarget(1, 2000, true)
  // The released listener stayed silent through the jump.
  expect(received).toEqual([0])

  expect(() => release()).toThrow(/stale/)
})

test('a released listener stops running, and the others keep theirs', () => {
  const { driver } = started()
  const first: number[] = []
  const second: number[] = []
  const releaseFirst = driver.subscribe((progress) => first.push(progress))
  driver.subscribe((progress) => second.push(progress))

  releaseFirst()
  driver.retarget(1, 2000, true)

  expect(first).toEqual([0])
  expect(second).toEqual([0, 1])
})
