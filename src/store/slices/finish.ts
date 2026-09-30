import {
  applyFinishEvent,
  initialFinishStatus,
  type FinishEvent,
  type FinishStatus,
} from './finish.logic'

export type { FinishStatus, FinishVariants, FinishOffer } from './finish.logic'

export type FinishSliceState = {
  finishStatus: FinishStatus
}

export type FinishSlice = FinishSliceState & {
  finishOffered: (product: string, variants: readonly string[]) => void
  finishSelected: (product: string, variant: string) => void
  finishReset: (product: string) => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetFinishState = (updater: (state: FinishSliceState) => Partial<FinishSliceState>) => void

export function createFinishSlice(set: SetFinishState): FinishSlice {
  const apply = (event: FinishEvent) => {
    set((state) => ({ finishStatus: applyFinishEvent(state.finishStatus, event) }))
  }

  return {
    finishStatus: initialFinishStatus,
    finishOffered: (product, variants) => apply({ kind: 'offered', product, variants }),
    finishSelected: (product, variant) => apply({ kind: 'selected', product, variant }),
    finishReset: (product) => apply({ kind: 'reset', product }),
  }
}

export function selectFinishStatus(state: FinishSliceState): FinishStatus {
  return state.finishStatus
}

// The selected variant of one product, or null while that product has no
// offer in the store. Every caller names the product it asks for, so a
// product switch renders the next product's default instead of reaching
// the last product's selection.
export function selectSelectedVariant(state: FinishSliceState, product: string): string | null {
  const status = state.finishStatus
  if (status.kind === 'offered' && status.offer.product === product) {
    return status.offer.selected
  }
  return null
}
