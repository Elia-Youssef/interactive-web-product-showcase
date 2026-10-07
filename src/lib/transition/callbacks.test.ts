import { describe, expect, it } from 'vitest'
import {
  initialTransitionCallbacks,
  stepTransitionCallbacks,
  type TransitionCallbacksEvent,
  type TransitionCallbacksState,
} from './callbacks'

// The callback ledger over every interleaving of phase changes and motion
// ends: the happy path, each phase abandoned or retargeted mid-motion, the
// double end, and the silent reduced-motion form swap. The expected fired
// callback is what the step pays, never what a timer guesses.

type Row = {
  readonly name: string
  readonly state: TransitionCallbacksState
  readonly event: TransitionCallbacksEvent
  readonly fired: 'covered' | 'revealed' | null
  readonly owed: 'covered' | 'revealed' | null
}

const IDLE = initialTransitionCallbacks
const oweCovered: TransitionCallbacksState = { owed: 'covered' }
const oweRevealed: TransitionCallbacksState = { owed: 'revealed' }

const rows: readonly Row[] = [
  {
    name: 'an end with no running motion fires nothing',
    state: IDLE,
    event: { kind: 'ended' },
    fired: null,
    owed: null,
  },
  {
    name: 'entering covering owes the covered callback',
    state: IDLE,
    event: { kind: 'phase', phase: 'covering' },
    fired: null,
    owed: 'covered',
  },
  {
    name: 're-entering covering while covering keeps the same single debt',
    state: oweCovered,
    event: { kind: 'phase', phase: 'covering' },
    fired: null,
    owed: 'covered',
  },
  {
    name: 'the end of the covering motion pays covered once and settles the debt',
    state: oweCovered,
    event: { kind: 'ended' },
    fired: 'covered',
    owed: null,
  },
  {
    name: 'a second end after the payment fires nothing',
    state: { owed: null },
    event: { kind: 'ended' },
    fired: null,
    owed: null,
  },
  {
    name: 'reaching covered settles the debt the covering motion still held',
    state: oweCovered,
    event: { kind: 'phase', phase: 'covered' },
    fired: null,
    owed: null,
  },
  {
    name: 'a covered phase left straight after a late end fires nothing',
    state: { owed: null },
    event: { kind: 'phase', phase: 'covered' },
    fired: null,
    owed: null,
  },
  {
    name: 'entering revealing owes the revealed callback',
    state: IDLE,
    event: { kind: 'phase', phase: 'revealing' },
    fired: null,
    owed: 'revealed',
  },
  {
    name: 're-entering revealing while revealing keeps the same single debt',
    state: oweRevealed,
    event: { kind: 'phase', phase: 'revealing' },
    fired: null,
    owed: 'revealed',
  },
  {
    name: 'the end of the revealing motion pays revealed once and settles the debt',
    state: oweRevealed,
    event: { kind: 'ended' },
    fired: 'revealed',
    owed: null,
  },
  {
    name: 'a switch retargeted mid-cover to revealing drops the covered debt',
    state: oweCovered,
    event: { kind: 'phase', phase: 'revealing' },
    fired: null,
    owed: 'revealed',
  },
  {
    name: 'a switch retargeted mid-reveal to covering drops the revealed debt',
    state: oweRevealed,
    event: { kind: 'phase', phase: 'covering' },
    fired: null,
    owed: 'covered',
  },
  {
    name: 'a switch abandoned mid-cover to idle drops the covered debt',
    state: oweCovered,
    event: { kind: 'phase', phase: 'idle' },
    fired: null,
    owed: null,
  },
  {
    name: 'a switch abandoned mid-reveal to idle drops the revealed debt',
    state: oweRevealed,
    event: { kind: 'phase', phase: 'idle' },
    fired: null,
    owed: null,
  },
  {
    name: 'the end of an abandoned motion fires nothing',
    state: { owed: null },
    event: { kind: 'ended' },
    fired: null,
    owed: null,
  },
]

describe('stepTransitionCallbacks', () => {
  it.each(rows)('$name', ({ state, event, fired, owed }) => {
    expect(stepTransitionCallbacks(state, event)).toEqual({ state: { owed }, fired })
  })

  it('pays each callback once over a whole switch, in order', () => {
    const fired: readonly string[] = run([
      { kind: 'phase', phase: 'covering' },
      { kind: 'ended' },
      { kind: 'phase', phase: 'covered' },
      { kind: 'phase', phase: 'revealing' },
      { kind: 'ended' },
      { kind: 'phase', phase: 'idle' },
    ])
    expect(fired).toEqual(['covered', 'revealed'])
  })

  it('pays nothing when the lifecycle skips ahead over a running cover', () => {
    const fired: readonly string[] = run([
      { kind: 'phase', phase: 'covering' },
      { kind: 'phase', phase: 'covered' },
      { kind: 'ended' },
      { kind: 'phase', phase: 'revealing' },
      { kind: 'ended' },
    ])
    expect(fired).toEqual(['revealed'])
  })

  it('pays only the new debt when the switch restarts mid-reveal', () => {
    const fired: readonly string[] = run([
      { kind: 'phase', phase: 'revealing' },
      { kind: 'phase', phase: 'covering' },
      { kind: 'ended' },
    ])
    expect(fired).toEqual(['covered'])
  })

  it('holds the debt across a mid-run reduced-motion form swap', () => {
    // The form swap sends no event: the component swaps its animation and
    // the end of the new animation pays the same debt. The ledger is the
    // same before and after the swap, so the single end pays once.
    const covering = stepTransitionCallbacks(IDLE, { kind: 'phase', phase: 'covering' })
    const afterSwap = stepTransitionCallbacks(covering.state, { kind: 'phase', phase: 'covering' })
    expect(stepTransitionCallbacks(afterSwap.state, { kind: 'ended' })).toEqual({
      state: { owed: null },
      fired: 'covered',
    })
  })

  it('answers the very state it was given for every step that changes nothing', () => {
    const settled: TransitionCallbacksState = { owed: null }
    expect(stepTransitionCallbacks(settled, { kind: 'ended' }).state).toBe(settled)
  })
})

function run(events: readonly TransitionCallbacksEvent[]): readonly string[] {
  const fired: string[] = []
  let state = initialTransitionCallbacks
  for (const event of events) {
    const step = stepTransitionCallbacks(state, event)
    state = step.state
    if (step.fired !== null) {
      fired.push(step.fired)
    }
  }
  return fired
}
