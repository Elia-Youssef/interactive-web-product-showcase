// The product's status, the domain's own shape of it: a union, not a flag
// pile, with exactly one of these kinds holding at any time. The rig
// summary and the model counts ride with the ready status, so the
// automation hook never recomputes them per access, and the typed failure
// rides with the failed status, so a reader tells the kind of failure from
// its facts, never from a message. The store's product slice carries this
// type, and every reader of the status (the loading readout's rule among
// them) reaches it through here, so the one list of kinds has one owner.

import type { ProductFailure } from './failure'
import type { ProductModelCounts } from './modelCounts'
import type { ProductRigSummary } from './rigSummary'

export type ProductStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; slug: string }
  | { kind: 'ready'; slug: string; rig: ProductRigSummary; model: ProductModelCounts }
  | { kind: 'failed'; slug: string; failure: ProductFailure }
