import type { ProductTransitionPhase } from '../transition'

// The product switch as one pure sequence: the route names the product the
// visitor asked for, the stage shows one product at a time, and every move
// between the two runs cover, swap, reveal, in that order, through one
// state. A navigation in any phase retargets the sequence that is running
// instead of starting a second one, so no transition stacks on another and
// the stage never mounts two products.
//
// The stage's product is one life: every swap starts a new life with its own
// number, and a settle report names the life it is about. A report from a
// life the stage has already left can then never reveal the life that
// replaced it, even when both lives show the same product: a visitor who
// leaves a product and comes straight back gets a fresh load, and only that
// load's settle counts.

// How the shown life ended its load: presented on a settled stage, or
// failed with a typed failure the stage shows. Both end the swap: a failed
// product is revealed so its alert is seen.
export type ProductSettleOutcome = 'ready' | 'failed'

// The life on the stage now: the product it shows, its number, and whether
// its load has settled yet.
export type ShownProduct = {
  readonly slug: string
  readonly life: number
  readonly outcome: ProductSettleOutcome | 'pending'
}

export type ProductSwitchState = {
  // The phase the transition draws.
  readonly phase: ProductTransitionPhase
  // The product the route names: where the sequence is going.
  readonly target: string
  // The life on the stage.
  readonly shown: ShownProduct
  // The last product that came to rest: the sequence had ended and the
  // product was presented. Its neighbors are the ones worth fetching ahead.
  // It holds through the next sequence, so the bytes fetched for it stay
  // until the next product comes to rest; null until a first rest.
  readonly rested: string | null
}

export type ProductSwitchEvent =
  // The route names a product: the visitor clicked, went back or forward,
  // or chose a row of the index.
  | { readonly kind: 'navigated'; readonly slug: string }
  // The transition reports the stage fully covered.
  | { readonly kind: 'covered' }
  // A product life reports its load settled.
  | {
      readonly kind: 'settled'
      readonly life: number
      readonly outcome: ProductSettleOutcome
    }
  // The transition reports the stage fully visible again.
  | { readonly kind: 'revealed' }

// The first product of a page is mounted at once, with nothing to cover:
// the stage starts empty, so there is no old product to hide.
export function initialProductSwitch(slug: string): ProductSwitchState {
  return {
    phase: 'idle',
    target: slug,
    shown: { slug, life: 0, outcome: 'pending' },
    rested: null,
  }
}

export function applyProductSwitchEvent(
  state: ProductSwitchState,
  event: ProductSwitchEvent,
): ProductSwitchState {
  return withRest(nextState(state, event))
}

function nextState(state: ProductSwitchState, event: ProductSwitchEvent): ProductSwitchState {
  switch (event.kind) {
    case 'navigated':
      return navigated(state, event.slug)
    case 'covered':
      // Only the cover that is running can land; a report of any other
      // phase is a transition that ended after the sequence moved on.
      return state.phase === 'covering' ? revealIfSettled(swapToTarget(covered(state))) : state
    case 'settled':
      return settled(state, event.life, event.outcome)
    case 'revealed':
      return state.phase === 'revealing' ? { ...state, phase: 'idle' } : state
  }
}

// A navigation retargets whatever runs. While the stage still shows its
// product (idle, revealing) a move to another product starts a cover; while
// the cover runs the target simply changes; once the stage is covered the
// swap follows the target at once. A navigation to the target the sequence
// already has is no request at all, in any phase: the state is kept as it
// is, the same object, so a reader that compares states sees no change.
function navigated(state: ProductSwitchState, slug: string): ProductSwitchState {
  if (slug === state.target) {
    return state
  }
  const retargeted = { ...state, target: slug }
  switch (state.phase) {
    case 'idle':
    case 'revealing':
      // The stage shows its target in both, so any other product needs a
      // cover first.
      return { ...retargeted, phase: 'covering' }
    case 'covering':
      return retargeted
    case 'covered':
      return revealIfSettled(swapToTarget(retargeted))
  }
}

function covered(state: ProductSwitchState): ProductSwitchState {
  return { ...state, phase: 'covered' }
}

// The swap: a new life for the target, unless the stage already shows it.
// It only ever runs on a covered stage.
function swapToTarget(state: ProductSwitchState): ProductSwitchState {
  if (state.target === state.shown.slug) {
    return state
  }
  return {
    ...state,
    shown: { slug: state.target, life: state.shown.life + 1, outcome: 'pending' },
  }
}

// A covered stage is revealed once its life has settled.
function revealIfSettled(state: ProductSwitchState): ProductSwitchState {
  return state.phase === 'covered' && state.shown.outcome !== 'pending'
    ? { ...state, phase: 'revealing' }
    : state
}

// The first settle of the shown life counts; a settle of any other life, or
// a second report of the same one, changes nothing.
function settled(
  state: ProductSwitchState,
  life: number,
  outcome: ProductSettleOutcome,
): ProductSwitchState {
  if (life !== state.shown.life || state.shown.outcome !== 'pending') {
    return state
  }
  return revealIfSettled({ ...state, shown: { ...state.shown, outcome } })
}

// The rest: no sequence runs and the shown product is presented.
function withRest(state: ProductSwitchState): ProductSwitchState {
  const resting = state.phase === 'idle' && state.shown.outcome === 'ready'
  return resting && state.rested !== state.shown.slug
    ? { ...state, rested: state.shown.slug }
    : state
}
