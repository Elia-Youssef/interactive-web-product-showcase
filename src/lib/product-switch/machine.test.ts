import { describe, expect, it } from 'vitest'
import type { ProductTransitionPhase } from '../transition'
import {
  applyProductSwitchEvent,
  initialProductSwitch,
  type ProductSwitchEvent,
  type ProductSwitchState,
} from './machine'

const navigated = (slug: string): ProductSwitchEvent => ({ kind: 'navigated', slug })
const covered: ProductSwitchEvent = { kind: 'covered' }
const revealed: ProductSwitchEvent = { kind: 'revealed' }
const ready = (life: number): ProductSwitchEvent => ({ kind: 'settled', life, outcome: 'ready' })
const failed = (life: number): ProductSwitchEvent => ({ kind: 'settled', life, outcome: 'failed' })

function run(events: readonly ProductSwitchEvent[], start = 'a'): ProductSwitchState {
  return events.reduce(applyProductSwitchEvent, initialProductSwitch(start))
}

// A at rest: the first product presented, nothing running.
const atRest = [ready(0)]

describe('the first product', () => {
  it('mounts at once with nothing to cover', () => {
    expect(run([])).toEqual({
      phase: 'idle',
      target: 'a',
      shown: { slug: 'a', life: 0, outcome: 'pending' },
      rested: null,
    })
  })

  it('comes to rest when it settles ready', () => {
    const state = run(atRest)
    expect(state.phase).toBe('idle')
    expect(state.shown.outcome).toBe('ready')
    expect(state.rested).toBe('a')
  })

  it('does not come to rest when it fails', () => {
    const state = run([failed(0)])
    expect(state.shown.outcome).toBe('failed')
    expect(state.rested).toBeNull()
  })

  it('stays put when the route names the product it shows', () => {
    expect(run([...atRest, navigated('a')])).toEqual(run(atRest))
  })

  it('keeps the very same state when the route names the target it already has', () => {
    const state = run(atRest)
    expect(applyProductSwitchEvent(state, navigated('a'))).toBe(state)
  })
})

describe('one switch', () => {
  it('covers, swaps on the covered stage, reveals once the next life is ready, then rests', () => {
    const covering = run([...atRest, navigated('b')])
    expect(covering.phase).toBe('covering')
    expect(covering.target).toBe('b')
    // The cover runs over the old product: nothing is swapped yet.
    expect(covering.shown).toEqual({ slug: 'a', life: 0, outcome: 'ready' })

    const swapped = applyProductSwitchEvent(covering, covered)
    expect(swapped.phase).toBe('covered')
    expect(swapped.shown).toEqual({ slug: 'b', life: 1, outcome: 'pending' })
    // The neighbors of the last rest stay wanted through the sequence.
    expect(swapped.rested).toBe('a')

    const revealing = applyProductSwitchEvent(swapped, ready(1))
    expect(revealing.phase).toBe('revealing')
    expect(revealing.rested).toBe('a')

    const idle = applyProductSwitchEvent(revealing, revealed)
    expect(idle.phase).toBe('idle')
    expect(idle.rested).toBe('b')
  })

  it('reveals a failed life so its alert shows, and keeps the last rest', () => {
    const state = run([...atRest, navigated('b'), covered, failed(1)])
    expect(state.phase).toBe('revealing')
    const idle = applyProductSwitchEvent(state, revealed)
    expect(idle.phase).toBe('idle')
    expect(idle.shown.outcome).toBe('failed')
    expect(idle.rested).toBe('a')
  })

  it('keeps the first settle of a life: a later report of the same life changes nothing', () => {
    const state = run([...atRest, navigated('b'), covered, ready(1), revealed])
    expect(applyProductSwitchEvent(state, failed(1))).toEqual(state)
  })
})

describe('a navigation during a running switch retargets it', () => {
  it('mid-cover: the swap goes straight to the newest target', () => {
    const state = run([...atRest, navigated('b'), navigated('c')])
    expect(state.phase).toBe('covering')
    expect(state.target).toBe('c')
    const swapped = applyProductSwitchEvent(state, covered)
    // B never mounts: the one swap is to C, as life 1.
    expect(swapped.shown).toEqual({ slug: 'c', life: 1, outcome: 'pending' })
  })

  it('mid-cover back to the shown product: no swap, the cover lands and reveals at once', () => {
    const state = run([...atRest, navigated('b'), navigated('a'), covered])
    expect(state.phase).toBe('revealing')
    expect(state.shown).toEqual({ slug: 'a', life: 0, outcome: 'ready' })
  })

  it('mid-cover to the target again: a fast second click is the same request, one swap runs', () => {
    // The panel shows the product on stage, so a second click during the
    // cover asks the running sequence for the product it already targets.
    const state = run([...atRest, navigated('b'), navigated('b')])
    expect(state.phase).toBe('covering')
    // Nothing has swapped: the stage still shows the product it started with.
    expect(state.shown).toEqual({ slug: 'a', life: 0, outcome: 'ready' })
    const swapped = applyProductSwitchEvent(state, covered)
    expect(swapped.shown).toEqual({ slug: 'b', life: 1, outcome: 'pending' })
  })

  it('mid-load: the loading life leaves at once and the newest target mounts as a new life', () => {
    const state = run([...atRest, navigated('b'), covered, navigated('c')])
    expect(state.phase).toBe('covered')
    expect(state.shown).toEqual({ slug: 'c', life: 2, outcome: 'pending' })
  })

  it('a load that finishes after a newer navigation reveals nothing', () => {
    const state = run([...atRest, navigated('b'), covered, navigated('c'), ready(1)])
    expect(state.phase).toBe('covered')
    expect(state.shown).toEqual({ slug: 'c', life: 2, outcome: 'pending' })
    expect(applyProductSwitchEvent(state, ready(2)).phase).toBe('revealing')
  })

  it('a product left mid-load and chosen again loads as a fresh life', () => {
    const state = run([...atRest, navigated('b'), covered, navigated('a')])
    expect(state.shown).toEqual({ slug: 'a', life: 2, outcome: 'pending' })
    // The report of the life the stage left first (life 0) counts nothing.
    expect(applyProductSwitchEvent(state, ready(0)).phase).toBe('covered')
  })

  it('mid-reveal: a new cover starts and the running reveal can no longer land', () => {
    const state = run([...atRest, navigated('b'), covered, ready(1), navigated('c')])
    expect(state.phase).toBe('covering')
    expect(state.target).toBe('c')
    expect(applyProductSwitchEvent(state, revealed)).toEqual(state)
    const swapped = applyProductSwitchEvent(state, covered)
    expect(swapped.shown).toEqual({ slug: 'c', life: 2, outcome: 'pending' })
  })

  it('mid-reveal to the product being revealed: the reveal runs on', () => {
    const state = run([...atRest, navigated('b'), covered, ready(1), navigated('b')])
    expect(state.phase).toBe('revealing')
  })

  it('while the first product still loads: a cover starts over the empty stage', () => {
    const covering = run([navigated('b')])
    expect(covering.phase).toBe('covering')
    // The first life settles during the cover: it is recorded, not revealed.
    const settledDuringCover = applyProductSwitchEvent(covering, ready(0))
    expect(settledDuringCover.phase).toBe('covering')
    expect(settledDuringCover.rested).toBeNull()
    expect(applyProductSwitchEvent(settledDuringCover, covered).shown).toEqual({
      slug: 'b',
      life: 1,
      outcome: 'pending',
    })
  })
})

describe('reports that arrive out of phase', () => {
  const sequences: Readonly<Record<ProductTransitionPhase, readonly ProductSwitchEvent[]>> = {
    idle: atRest,
    covering: [...atRest, navigated('b')],
    covered: [...atRest, navigated('b'), covered],
    revealing: [...atRest, navigated('b'), covered, ready(1)],
  }

  for (const [phase, events] of Object.entries(sequences)) {
    it(`a cover landing in ${phase} changes nothing unless the cover runs`, () => {
      const state = run(events)
      const next = applyProductSwitchEvent(state, covered)
      if (phase === 'covering') {
        expect(next).not.toEqual(state)
      } else {
        expect(next).toEqual(state)
      }
    })

    it(`a reveal landing in ${phase} changes nothing unless the reveal runs`, () => {
      const state = run(events)
      const next = applyProductSwitchEvent(state, revealed)
      if (phase === 'revealing') {
        expect(next.phase).toBe('idle')
      } else {
        expect(next).toEqual(state)
      }
    })
  }
})
