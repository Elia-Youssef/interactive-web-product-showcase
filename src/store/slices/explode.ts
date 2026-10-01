import {
  applyExplodeEvent,
  initialExplodeStatus,
  type ExplodeEvent,
  type ExplodeStatus,
} from './explode.logic'

export type { ExplodeStatus } from './explode.logic'
export { initialExplodeStatus } from './explode.logic'

export type ExplodeSliceState = {
  explodeStatus: ExplodeStatus
}

export type ExplodeSlice = ExplodeSliceState & {
  explodeAttach: (product: string) => void
  explodeDetach: (product: string) => void
  explodeToggle: (product: string) => void
  explodeScrub: (product: string, target: number) => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetExplodeState = (updater: (state: ExplodeSliceState) => Partial<ExplodeSliceState>) => void

export function createExplodeSlice(set: SetExplodeState): ExplodeSlice {
  const apply = (event: ExplodeEvent) => {
    set((state) => ({ explodeStatus: applyExplodeEvent(state.explodeStatus, event) }))
  }

  return {
    explodeStatus: initialExplodeStatus,
    explodeAttach: (product) => apply({ kind: 'attached', product }),
    explodeDetach: (product) => apply({ kind: 'detached', product }),
    explodeToggle: (product) => apply({ kind: 'toggled', product }),
    explodeScrub: (product, target) => apply({ kind: 'scrubbed', product, target }),
  }
}

export function selectExplodeStatus(state: ExplodeSliceState): ExplodeStatus {
  return state.explodeStatus
}

// The subscription selectors answer primitives: the store subscription
// compares the selected value by identity, so a selector that built an
// object per read would loop the components that subscribe through it. The
// closed defaults below are what the state itself holds while a product has
// no attached view.

// Whether one product's presented view is attached. The toggle reads this
// as its disabled state: a click before the model is presented cannot arm
// anything.
export function selectExplodeAttached(state: ExplodeSliceState, product: string): boolean {
  const status = state.explodeStatus
  return status.kind === 'active' && status.product === product
}

// The target progress of one product's exploded view, 0 while it has no
// attached view.
export function selectExplodeTarget(state: ExplodeSliceState, product: string): number {
  const status = state.explodeStatus
  return status.kind === 'active' && status.product === product ? status.target : 0
}

// Whether one product's exploded view counts as open, false while it has
// no attached view.
export function selectExplodeOpen(state: ExplodeSliceState, product: string): boolean {
  const status = state.explodeStatus
  return status.kind === 'active' && status.product === product ? status.open : false
}
