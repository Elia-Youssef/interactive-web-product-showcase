import { afterEach, describe, expect, it, vi } from 'vitest'
import { deferredSignal } from '@lib/async/deferredSignal.fixtures'
import { observeTaskStarts } from '@lib/async/taskStarts.fixtures'
import { drainApplications } from './finishScheduling.fixtures'
import { createFinishApplier } from './finishApplier'
import { fakeLoad, fakeSettle, GRAPHITE, ownerOf, SAGE } from './finishApplier.fixtures'

// The applier's ordering claims, each made by the test's own hand: the fake
// settle's promises are resolved by the test, never by a wait.

afterEach(() => vi.restoreAllMocks())

describe('FinishApplier', () => {
  it('ends on the last of three selections queued during the first application', async () => {
    const task = observeTaskStarts(() => fake.settleCalls())
    const world = fakeLoad()
    const failures: Error[] = []
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, failures))

    applier.apply(SAGE)
    await task(0).started
    expect(task(0).atStart).toBe(1)
    // The first application is in flight: it holds one settle.
    expect(fake.settleCalls()).toBe(1)
    applier.apply(GRAPHITE)
    applier.apply(SAGE)
    await drainApplications(task, fake, 3)

    expect(world.shell.material).toBe(world.materials[0])
    expect(world.grille.material).toBe(world.materials[2])
    expect(failures).toEqual([])
  })

  it('ends on the last selection of every rapid sequence', async () => {
    const sequences: readonly (readonly string[])[] = [
      [GRAPHITE, SAGE, GRAPHITE],
      [SAGE, GRAPHITE, SAGE],
      [GRAPHITE, SAGE, GRAPHITE, SAGE, GRAPHITE],
    ]
    for (const sequence of sequences) {
      const task = observeTaskStarts(() => fake.settleCalls())
      const world = fakeLoad()
      const failures: Error[] = []
      const fake = fakeSettle(world)
      const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, failures))

      const last = sequence[sequence.length - 1]
      if (last === undefined) {
        throw new Error('the fixture sequence must not be empty')
      }
      for (const variant of sequence) {
        applier.apply(variant)
      }
      await drainApplications(task, fake, sequence.length)

      const expected = last === SAGE ? world.materials[0] : world.materials[1]
      expect(
        world.shell.material,
        `the sequence ${sequence.join(', ')} must end on '${last}'`,
      ).toBe(expected)
      expect(failures).toEqual([])
    }
  })

  it('a new applier for a new load precompiles again', async () => {
    const task = observeTaskStarts()
    const first = fakeLoad()
    const firstFake = fakeSettle(first)
    const firstApplier = createFinishApplier(ownerOf(first.loaded, firstFake.settle, []))
    firstApplier.apply(SAGE)
    await task(0).started
    expect(firstFake.precompiledAtSettle()).toEqual([true])
    firstFake.release(0)
    await task(0).finished

    // A plain application after the first does not precompile again.
    firstApplier.apply(GRAPHITE)
    await task(1).started
    expect(firstFake.precompiledAtSettle()).toEqual([true, false])
    firstFake.release(1)
    await task(1).finished

    const second = fakeLoad()
    const secondFake = fakeSettle(second)
    const secondApplier = createFinishApplier(ownerOf(second.loaded, secondFake.settle, []))
    secondApplier.apply(SAGE)
    await task(2).started
    expect(secondFake.precompiledAtSettle()).toEqual([true])
    secondFake.release(0)
    await task(2).finished
  })

  it('a disposed applier applies nothing more', async () => {
    const task = observeTaskStarts(() => fake.settleCalls())
    const world = fakeLoad()
    const failures: Error[] = []
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, failures))

    applier.apply(SAGE)
    await task(0).started
    expect(task(0).atStart).toBe(1)
    applier.apply(GRAPHITE)
    applier.dispose()
    applier.apply(GRAPHITE)
    fake.release(0)
    await task(1).finished

    expect(fake.settleCalls()).toBe(1)
    expect(world.shell.material).toBe(world.materials[0])
    expect(failures).toEqual([])

    const untouched = fakeLoad()
    const untouchedFake = fakeSettle(untouched)
    const disposed = createFinishApplier(ownerOf(untouched.loaded, untouchedFake.settle, []))
    disposed.dispose()
    disposed.apply(GRAPHITE)
    await disposed.firstApplied
    expect(untouchedFake.settleCalls()).toBe(0)
    expect(untouched.shell.material).toBe(untouched.materials[0])
  })

  it('after a new selection and before its step, applied is still the meshes and requested has moved', async () => {
    const task = observeTaskStarts(() => fake.settleCalls())
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await task(0).started
    expect(task(0).atStart).toBe(1)
    // The meshes carry sage; the selection moves to graphite while the
    // graphite step is still queued.
    applier.apply(GRAPHITE)
    expect(applier.readFinish()).toEqual({
      product: 'sample-one',
      applied: SAGE,
      requested: GRAPHITE,
      materials: { '0:0': 'MAT_shell_sage', '1:0': 'MAT_grille', '2:0': 'MAT_trim_sage' },
    })
  })

  it('after the step has run, applied and requested are the new selection', async () => {
    const task = observeTaskStarts(() => fake.settleCalls())
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await task(0).started
    expect(task(0).atStart).toBe(1)
    applier.apply(GRAPHITE)
    fake.release(0)
    await drainApplications(task, fake, 2)
    expect(applier.readFinish()).toEqual({
      product: 'sample-one',
      applied: GRAPHITE,
      requested: GRAPHITE,
      materials: { '0:0': 'MAT_shell_graphite', '1:0': 'MAT_grille', '2:0': 'MAT_trim_graphite' },
    })
  })

  it('meshes that carry materials from two variants read applied as null', async () => {
    const task = observeTaskStarts(() => fake.settleCalls())
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await task(0).started
    expect(task(0).atStart).toBe(1)
    // A mix no variant prescribes: the trim carries the graphite material
    // while everything else stands on sage.
    world.trim.material = world.materials[4]
    expect(applier.readFinish().applied).toBeNull()
    expect(applier.readFinish().requested).toBe(SAGE)
  })

  it('the finish read fails before the first selection instead of guessing', () => {
    const world = fakeLoad()
    const applier = createFinishApplier(ownerOf(world.loaded, () => Promise.resolve(), []))

    expect(() => applier.readFinish()).toThrow('before its first selection')
  })

  it('a failed application reaches the owner', async () => {
    const task = observeTaskStarts()
    const world = fakeLoad()
    const failures: Error[] = []
    const failure = new Error('the compile failed')
    const { promise: failureReported, resolve: report } = deferredSignal()
    const applier = createFinishApplier({
      loaded: world.loaded,
      settle: () => Promise.reject(failure),
      onFailure: (error) => {
        failures.push(error)
        report()
      },
    })

    applier.apply(SAGE)
    await task(0).finished
    // The failure handler is attached to the caller promise returned by
    // the chain, so observe that channel directly.
    await failureReported

    expect(failures).toEqual([failure])
  })
})
