// Whether the loading readout is wanted on a stage: while no product is
// presented on a stage that has not failed, and no product switch runs (the
// switch band is the switch's own signal, so the readout stays out of its
// way).
//
// The rule switches on every phase, every renderer kind and every product
// kind, each owned by the module that declares it, so a new one of any of
// them fails this switch's exhaustiveness instead of passing silently: the
// switch phases come from the transition contract, and the statuses are the
// domain unions the store's slices carry.

import type { ProductStatus } from '../product/status'
import type { RendererStatus } from '../renderer/status'
import type { ProductTransitionPhase } from '../transition/contract'

// The statuses the readout's visibility reads, as their kinds.
export type LoadReadoutStatuses = {
  readonly renderer: RendererStatus['kind']
  readonly product: ProductStatus['kind']
  readonly phase: ProductTransitionPhase
}

export function loadReadoutWanted(statuses: LoadReadoutStatuses): boolean {
  switch (statuses.phase) {
    case 'covering':
    case 'covered':
    case 'revealing':
      return false
    case 'idle':
      switch (statuses.renderer) {
        case 'failed':
          return false
        case 'initializing':
        case 'ready':
          switch (statuses.product) {
            case 'ready':
            case 'failed':
              return false
            case 'idle':
            case 'loading':
              return true
          }
      }
  }
}
