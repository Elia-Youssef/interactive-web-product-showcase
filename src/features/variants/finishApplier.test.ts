import { describe, expect, it } from 'vitest'
import { createFinishApplier } from './finishApplier'
import {
  drain,
  fakeLoad,
  fakeSettle,
  GRAPHITE,
  nextTurn,
  ownerOf,
  SAGE,
} from './finishApplier.fixtures'

// The applier's ordering claims, each made by the test's own hand: the fake
// settle's promises are resolved by the test, never by a wait.

describe('FinishApplier', () => {
  it('ends on the last of three selections queued during the first application', async () => {
    const world = fakeLoad()
    const failures: Error[] = []
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, failures))

    applier.apply(SAGE)
    await nextTurn()
    // The first application is in flight: it holds one settle.
    expect(fake.settleCalls()).toBe(1)
    applier.apply(GRAPHITE)
    applier.apply(SAGE)
    await drain(fake, 3)

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
      await drain(fake, sequence.length)

      const expected = last === SAGE ? world.materials[0] : world.materials[1]
      expect(
        world.shell.material,
        `the sequence ${sequence.join(', ')} must end on '${last}'`,
      ).toBe(expected)
      expect(failures).toEqual([])
    }
  })

  it('a new applier for a new load precompiles again', async () => {
    const first = fakeLoad()
    const firstFake = fakeSettle(first)
    const firstApplier = createFinishApplier(ownerOf(first.loaded, firstFake.settle, []))
    firstApplier.apply(SAGE)
    await nextTurn()
    expect(firstFake.precompiledAtSettle()).toEqual([true])
    firstFake.releaseAll()
    await nextTurn()

    // A plain application after the first does not precompile again.
    firstApplier.apply(GRAPHITE)
    await nextTurn()
    expect(firstFake.precompiledAtSettle()).toEqual([true, false])
    firstFake.releaseAll()
    await nextTurn()

    const second = fakeLoad()
    const secondFake = fakeSettle(second)
    const secondApplier = createFinishApplier(ownerOf(second.loaded, secondFake.settle, []))
    secondApplier.apply(SAGE)
    await nextTurn()
    expect(secondFake.precompiledAtSettle()).toEqual([true])
    secondFake.releaseAll()
    await nextTurn()
  })

  it('a disposed applier applies nothing more', async () => {
    const world = fakeLoad()
    const failures: Error[] = []
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, failures))

    applier.apply(SAGE)
    await nextTurn()
    applier.dispose()
    applier.apply(GRAPHITE)
    fake.releaseAll()
    await nextTurn()
    await nextTurn()

    expect(fake.settleCalls()).toBe(1)
    expect(world.shell.material).toBe(world.materials[0])
    expect(failures).toEqual([])

    const untouched = fakeLoad()
    const untouchedFake = fakeSettle(untouched)
    const disposed = createFinishApplier(ownerOf(untouched.loaded, untouchedFake.settle, []))
    disposed.dispose()
    disposed.apply(GRAPHITE)
    await nextTurn()
    expect(untouchedFake.settleCalls()).toBe(0)
    expect(untouched.shell.material).toBe(untouched.materials[0])
  })

  it('after a new selection and before its step, applied is still the meshes and requested has moved', async () => {
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await nextTurn()
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
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await nextTurn()
    applier.apply(GRAPHITE)
    fake.releaseAll()
    await drain(fake, 2)
    expect(applier.readFinish()).toEqual({
      product: 'sample-one',
      applied: GRAPHITE,
      requested: GRAPHITE,
      materials: { '0:0': 'MAT_shell_graphite', '1:0': 'MAT_grille', '2:0': 'MAT_trim_graphite' },
    })
  })

  it('meshes that carry materials from two variants read applied as null', async () => {
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const applier = createFinishApplier(ownerOf(world.loaded, fake.settle, []))

    applier.apply(SAGE)
    await nextTurn()
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
    const world = fakeLoad()
    const failures: Error[] = []
    const failure = new Error('the compile failed')
    const applier = createFinishApplier({
      loaded: world.loaded,
      settle: () => Promise.reject(failure),
      onFailure: (error) => {
        failures.push(error)
      },
    })

    applier.apply(SAGE)
    await nextTurn()
    await nextTurn()

    expect(failures).toEqual([failure])
  })
})
