import { describe, expect, it } from 'vitest'
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
const stageFailed = (life: number): ProductSwitchEvent => ({ kind: 'stage-failed', life })

// Every sequence of events up to a length, over three products, every
// report and settles of the first lives, checked against the rules no
// interleaving may break.
describe('every interleaving', () => {
  const alphabet: readonly ProductSwitchEvent[] = [
    navigated('a'),
    navigated('b'),
    navigated('c'),
    covered,
    revealed,
    ready(0),
    ready(1),
    ready(2),
    failed(1),
    failed(2),
    stageFailed(0),
    stageFailed(1),
    stageFailed(2),
  ]
  const allowedMoves = new Set([
    'idle>covering',
    'covering>covered',
    'covering>revealing',
    'covered>revealing',
    'revealing>idle',
    'revealing>covering',
  ])

  function* sequences(length: number): Generator<readonly ProductSwitchEvent[]> {
    if (length === 0) {
      yield []
      return
    }
    for (const prefix of sequences(length - 1)) {
      for (const event of alphabet) {
        yield [...prefix, event]
      }
    }
  }

  // The rules one step must keep, as plain checks: the walk runs hundreds
  // of thousands of steps, and the message names the broken rule.
  function checkStep(
    before: ProductSwitchState,
    event: ProductSwitchEvent,
    after: ProductSwitchState,
  ): string | null {
    if (after.phase !== before.phase && !allowedMoves.has(`${before.phase}>${after.phase}`)) {
      return `the phase moved ${before.phase} to ${after.phase}`
    }
    if (after.shown.slug !== before.shown.slug || after.shown.life !== before.shown.life) {
      // A swap runs only on a covered stage: one that was covered already,
      // or the cover's own landing. It starts exactly one new life, and
      // mounts the target.
      const onCover =
        before.phase === 'covered' || (before.phase === 'covering' && event.kind === 'covered')
      if (!onCover) {
        return `a swap ran in ${before.phase} on ${event.kind}`
      }
      if (after.shown.life !== before.shown.life + 1) {
        return 'a swap skipped a life number'
      }
      if (after.shown.slug !== after.target || after.shown.outcome !== 'pending') {
        return 'a swap mounted something other than a fresh life of the target'
      }
    }
    if (after.phase === 'revealing' && after.shown.outcome === 'pending') {
      return 'a reveal started before the shown life settled'
    }
    if (
      after.phase === 'covered' &&
      (after.shown.outcome !== 'pending' || after.shown.slug !== after.target)
    ) {
      return 'a covered stage holds a settled life or a product other than the target'
    }
    if (
      after.rested !== before.rested &&
      (after.phase !== 'idle' ||
        after.shown.outcome !== 'ready' ||
        after.rested !== after.shown.slug)
    ) {
      return 'the rest moved without the shown product resting'
    }
    if (
      (event.kind === 'settled' || event.kind === 'stage-failed') &&
      event.life !== before.shown.life &&
      after !== before
    ) {
      return 'a settle of a life the stage left changed the state'
    }
    if (
      (event.kind === 'settled' || event.kind === 'stage-failed') &&
      before.shown.outcome !== 'pending' &&
      after !== before
    ) {
      return 'a life ended more than once'
    }
    if (
      event.kind === 'stage-failed' &&
      event.life === before.shown.life &&
      before.shown.outcome === 'pending' &&
      after.shown.outcome !== 'stage-failed'
    ) {
      return 'a stage failure did not end the pending shown life as a stage failure'
    }
    if (event.kind === 'navigated' && event.slug === before.target && after !== before) {
      return 'a navigation to the target the sequence already has made a new state'
    }
    if (
      (after.phase === 'idle' || after.phase === 'revealing') &&
      after.shown.slug !== after.target
    ) {
      return `a stage in ${after.phase} shows a product other than its target`
    }
    return null
  }

  it('keeps every rule over every sequence of five events', () => {
    let checked = 0
    for (const events of sequences(5)) {
      let state = initialProductSwitch('a')
      for (const event of events) {
        const next = applyProductSwitchEvent(state, event)
        const broken = checkStep(state, event, next)
        if (broken !== null) {
          throw new Error(`${broken} after ${JSON.stringify(events)}`)
        }
        state = next
      }
      checked += 1
    }
    expect(checked).toBe(alphabet.length ** 5)
  })
})
