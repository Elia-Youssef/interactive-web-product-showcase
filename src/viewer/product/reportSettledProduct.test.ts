import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductFailure } from '@lib/product'
import { StageRetiredError } from '../StageRetiredError'
import { reportSettledProduct } from './reportSettledProduct'

// A settle promise the tests resolve or reject by hand, so the order of the
// report and the failure is exact, with no clock and no DOM.
function manualSettle(): {
  readonly promise: Promise<void>
  readonly resolve: () => void
  readonly reject: (cause: unknown) => void
} {
  let resolve: () => void = () => {}
  let reject: (cause: unknown) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Resolves with true when the step did not settle within a macrotask turn:
// every microtask has run by then, so a step that does not wait for its
// settle would have finished.
async function stillPending(step: Promise<void>): Promise<boolean> {
  let pending = true
  void step.then(() => {
    pending = false
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return pending
}

// One report step over a manual settle, with its callbacks recorded and the
// cancellation switchable by the test.
function reportStep(outcome: 'ready' | 'failed' = 'ready') {
  const settle = manualSettle()
  const report = vi.fn<() => void>()
  const fail = vi.fn<(failure: ProductFailure) => void>()
  let cancelled = false
  const step = reportSettledProduct({
    ...(outcome === 'ready' ? { outcome, fail } : { outcome }),
    settle: settle.promise,
    report,
    isCancelled: () => cancelled,
  })
  return {
    settle,
    report,
    fail,
    step,
    cancel: () => {
      cancelled = true
    },
  }
}

describe('reportSettledProduct', () => {
  afterEach(() => vi.restoreAllMocks())
  it.each(['ready', 'failed'] as const)(
    'a disposed %s settle ends quietly, without applying an outcome',
    async (outcome) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { settle, report, fail, step } = reportStep(outcome)
      settle.reject(new StageRetiredError('disposed'))
      await expect(step).resolves.toBeUndefined()
      expect(report).not.toHaveBeenCalled()
      expect(fail).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    },
  )

  it.each(['ready', 'failed'] as const)(
    'a retired %s settle still applies its failure behavior',
    async (outcome) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { settle, report, fail, step } = reportStep(outcome)
      const cause = new StageRetiredError('retired')
      settle.reject(cause)
      await expect(step).resolves.toBeUndefined()
      if (outcome === 'ready') {
        expect(fail).toHaveBeenCalledExactlyOnceWith({
          kind: 'presentation',
          message: cause.message,
        })
        expect(report).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
      } else {
        expect(report).toHaveBeenCalledOnce()
        expect(fail).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledExactlyOnceWith(cause)
      }
    },
  )

  it.each(['ready', 'failed'] as const)(
    'reports %s only once the settle resolves',
    async (outcome) => {
      const { settle, report, fail, step } = reportStep(outcome)

      expect(await stillPending(step)).toBe(true)
      expect(report).not.toHaveBeenCalled()

      settle.resolve()
      await step
      expect(report).toHaveBeenCalledOnce()
      expect(fail).not.toHaveBeenCalled()
    },
  )

  it('routes a settle rejection to the fail callback as the typed presentation failure', async () => {
    const { settle, report, fail, step } = reportStep()

    settle.reject(new Error('the settle broke'))
    await expect(step).resolves.toBeUndefined()
    expect(fail).toHaveBeenCalledOnce()
    expect(fail).toHaveBeenCalledWith({ kind: 'presentation', message: 'the settle broke' })
    expect(report).not.toHaveBeenCalled()
  })

  it('carries the text of a rejection that is not an Error', async () => {
    const { settle, fail, step } = reportStep()

    settle.reject('the settle broke')
    await step
    expect(fail).toHaveBeenCalledWith({ kind: 'presentation', message: 'the settle broke' })
  })

  it.each(['ready', 'failed'] as const)('reports no %s after cancellation', async (outcome) => {
    const { settle, report, fail, step, cancel } = reportStep(outcome)

    cancel()
    settle.resolve()
    await step
    expect(report).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })

  it.each(['ready', 'failed'] as const)(
    'handles a rejected %s settle after cancellation without reporting',
    async (outcome) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { settle, report, fail, step, cancel } = reportStep(outcome)

      cancel()
      settle.reject(new Error('the settle broke'))
      await expect(step).resolves.toBeUndefined()
      expect(report).not.toHaveBeenCalled()
      expect(fail).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    },
  )

  it('still reports failed once on rejection and leaves the rejection loud', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { settle, report, fail, step } = reportStep('failed')
    const cause = new Error('the empty-stage settle broke')

    expect(await stillPending(step)).toBe(true)
    expect(report).not.toHaveBeenCalled()
    settle.reject(cause)
    await expect(step).resolves.toBeUndefined()
    expect(report).toHaveBeenCalledOnce()
    expect(fail).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(cause)
  })
})
