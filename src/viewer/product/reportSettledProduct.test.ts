import { describe, expect, it, vi } from 'vitest'
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
function reportStep() {
  const settle = manualSettle()
  const report = vi.fn<() => void>()
  const fail = vi.fn<(error: Error) => void>()
  let cancelled = false
  const step = reportSettledProduct({
    settle: settle.promise,
    report,
    fail,
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
  it('reports only once the settle resolves', async () => {
    const { settle, report, fail, step } = reportStep()

    expect(await stillPending(step)).toBe(true)
    expect(report).not.toHaveBeenCalled()

    settle.resolve()
    await step
    expect(report).toHaveBeenCalledOnce()
    expect(fail).not.toHaveBeenCalled()
  })

  it('routes a settle rejection to the fail callback, never to the report', async () => {
    const { settle, report, fail, step } = reportStep()
    const cause = new Error('the compile failed')

    settle.reject(cause)
    await expect(step).resolves.toBeUndefined()
    expect(fail).toHaveBeenCalledOnce()
    expect(fail).toHaveBeenCalledWith(cause)
    expect(report).not.toHaveBeenCalled()
  })

  it('fails with an Error when the rejection is not one', async () => {
    const { settle, fail, step } = reportStep()

    settle.reject('the compile failed')
    await step
    const error = fail.mock.calls[0]?.[0]
    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toBe('the compile failed')
  })

  it('reports nothing for a settle that resolves after cancellation', async () => {
    const { settle, report, fail, step, cancel } = reportStep()

    cancel()
    settle.resolve()
    await step
    expect(report).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })

  it('fails nothing for a settle that rejects after cancellation, and stays handled', async () => {
    const { settle, report, fail, step, cancel } = reportStep()

    cancel()
    settle.reject(new Error('the compile failed'))
    await expect(step).resolves.toBeUndefined()
    expect(report).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })
})
