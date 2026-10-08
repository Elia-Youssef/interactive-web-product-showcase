// The callback side of the product switch transition, as one pure step
// function. The transition's motion owes two callbacks: onCovered, owed by
// the covering move, and onRevealed, owed by the revealing move. A phase
// change settles or retargets the debt in one step, so a phase left
// mid-motion owes nothing from then on, and a motion end pays exactly the
// debt the running phase holds: no callback fires twice, and none fires
// for a motion that was replaced.
//
// A replaced motion never reports an end (its animation is canceled, and
// the browser fires animationcancel, not animationend), so the first end
// after a retarget is always the motion now running. The step function
// still answers the stale case: an end with no debt fires nothing.
//
// The reduced-motion form is silent here on purpose: switching the form
// mid-run swaps the animation, whose end then pays the same debt. No
// event, no extra state, the same callback, in the same order.

import type { ProductTransitionPhase } from './contract'

// The callback a running motion owes, or null while no motion runs.
export type TransitionCallbacksState = {
  readonly owed: 'covered' | 'revealed' | null
}

export const initialTransitionCallbacks: TransitionCallbacksState = { owed: null }

export type TransitionCallbacksEvent =
  { readonly kind: 'phase'; readonly phase: ProductTransitionPhase } | { readonly kind: 'ended' }

// One step: the next state, and the callback the step fires, or null.
export type TransitionCallbacksStep = {
  readonly state: TransitionCallbacksState
  readonly fired: 'covered' | 'revealed' | null
}

export function stepTransitionCallbacks(
  state: TransitionCallbacksState,
  event: TransitionCallbacksEvent,
): TransitionCallbacksStep {
  switch (event.kind) {
    case 'phase':
      return { state: { owed: owedByPhase(event.phase) }, fired: null }
    case 'ended':
      return endedStep(state)
  }
}

function owedByPhase(phase: ProductTransitionPhase): 'covered' | 'revealed' | null {
  switch (phase) {
    case 'idle':
      return null
    case 'covering':
      return 'covered'
    case 'covered':
      // The cover has landed, or the lifecycle moved on from covering
      // before it did: either way the debt is settled.
      return null
    case 'revealing':
      return 'revealed'
  }
}

function endedStep(state: TransitionCallbacksState): TransitionCallbacksStep {
  if (state.owed === null) {
    return { state, fired: null }
  }
  return { state: { owed: null }, fired: state.owed }
}
