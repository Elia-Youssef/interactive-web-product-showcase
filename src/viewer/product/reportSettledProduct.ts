import type { ProductFailure } from '@lib/product'
import { reportStageSettleFailure } from '../reportStageSettleFailure'

// Every outcome that ends a product swap reports after the stage settles:
// ready means presented content, failed means the stage without that
// content. Cancellation belongs to the caller's life or effect run.

// The inputs of one report step. The cancellation is read, never owned: the
// caller's cleanup decides when it turns true, so this module holds no
// state of its own.
export type SettledProductReport = {
  readonly settle: Promise<void>
  readonly report: () => void
  readonly isCancelled: () => boolean
} & (
  | { readonly outcome: 'ready'; readonly fail: (failure: ProductFailure) => void }
  | { readonly outcome: 'failed' }
)

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
        reportStageSettleFailure(cause, (error) => {
          if (input.outcome === 'ready') {
            input.fail({ kind: 'presentation', message: error.message })
          } else {
            // The failure is already in the store. Reveal its alert even
            // if its renderer retired, and keep that rejection loud.
            console.error(error)
            input.report()
          }
        })
      }
    },
  )
}
