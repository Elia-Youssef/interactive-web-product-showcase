import { createContext, useContext } from 'react'
import { PendingGate } from '@lib/async/pendingGate'

// The ready gate of one presented product: the extensions whose first work
// belongs to the presentation the ready status reports (the first finish
// application, which also carries the load-time precompile) hold that work
// on the gate, and the presentation's ready settle waits for it. The order
// is stated here instead of following from effect timing: a settle queued by
// a child's effect can still enter the stage's chain after a settle its
// parent's passive effect started, whenever React flushes the passive
// effects inside the same task.
export const ProductReadyGateContext = createContext<PendingGate | null>(null)

// A fresh gate for a presented product.
export function createProductReadyGate(): PendingGate {
  return new PendingGate()
}

// The ready gate of the product around the calling extension. An extension
// rendered anywhere else is a composition error, so it fails loudly instead
// of holding work no presentation waits for.
export function useProductReadyGate(): PendingGate {
  const gate = useContext(ProductReadyGateContext)
  if (gate === null) {
    throw new Error('a product extension holds ready work outside a presented product')
  }
  return gate
}

// The presentation's ready settle: it waits for every first work held on
// the gate when it is called, then settles the stage, unless the
// presentation was cancelled meanwhile; a cancelled presentation reports
// nothing, so it settles nothing either.
export function settleWhenReady(input: {
  readonly gate: PendingGate
  readonly settle: () => Promise<void>
  readonly isCancelled: () => boolean
}): Promise<void> {
  return input.gate.whenSettled().then(() => (input.isCancelled() ? undefined : input.settle()))
}
