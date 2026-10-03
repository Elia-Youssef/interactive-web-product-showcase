import { asError } from '@lib/errors'
import type { ProductFailure } from '@lib/product'

// The report step of a presented product, as pure logic: it connects one
// settle promise to the two outcomes of the product's stage life. The
// report fires only after the settle resolves, so the store's ready status
// means a product on a recorded frame, not one whose render pipelines may
// still be pending. A rejection reaches the fail callback as the typed
// presentation failure, carrying the rejection's message. After
// cancellation neither fires: either the product has left the stage, or its
// effect ran again and waits on a settle of its own, which reports the same
// scene.

// The inputs of one report step. The cancellation is read, never owned: the
// caller's cleanup decides when it turns true, so this module holds no
// state of its own.
export type SettledProductReport = {
  readonly settle: Promise<void>
  readonly report: () => void
  readonly fail: (failure: ProductFailure) => void
  readonly isCancelled: () => boolean
}

// Returns the handled step: it resolves once the outcome is applied and
// never rejects, because routing the settle's rejection is this step's job.
export function reportSettledProduct(input: SettledProductReport): Promise<void> {
  return input.settle.then(
    () => {
      if (!input.isCancelled()) {
        input.report()
      }
    },
    (cause: unknown) => {
      if (!input.isCancelled()) {
        input.fail({ kind: 'presentation', message: asError(cause).message })
      }
    },
  )
}
