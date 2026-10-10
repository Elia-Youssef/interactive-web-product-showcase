import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { observePageErrors } from './pageErrors.ts'

function pendingArgument() {
  let resolve: (value: unknown) => void = () => undefined
  let reject: (cause: unknown) => void = () => undefined
  const value = new Promise<unknown>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return {
    resolve,
    reject,
    argument: { evaluate: (render: (value: unknown) => string) => value.then(render) },
  }
}

describe('the page error gate event lifetime', () => {
  it('drains every received argument read before completing teardown', async () => {
    const page = new EventEmitter()
    const observed = observePageErrors(page)
    observed.ledger.expect(/^console error: first$/, { times: 1 })
    observed.ledger.expect(/^console error: second$/, { times: 1 })
    const first = pendingArgument()
    const second = pendingArgument()
    for (const pending of [first, second]) {
      page.emit('console', {
        type: () => 'error',
        args: () => [pending.argument],
        text: () => 'an engine rendering',
      })
    }
    let stopped = false
    const stop = observed.stop().then(() => {
      stopped = true
    })
    second.resolve('second')
    await Promise.resolve()
    expect(stopped).toBe(false)
    first.resolve('first')
    await stop
    expect(stopped).toBe(true)
    expect(observed.ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
    expect(page.listenerCount('console')).toBe(0)
    expect(page.listenerCount('pageerror')).toBe(0)
  })

  it('keeps unread errors as a gate failure, including all read causes', async () => {
    const page = new EventEmitter()
    const observed = observePageErrors(page)
    const first = pendingArgument()
    const second = pendingArgument()
    for (const pending of [first, second]) {
      page.emit('console', {
        type: () => 'error',
        args: () => [pending.argument],
        text: () => 'a text that must not replace the lost argument',
      })
    }
    const firstCause = new Error('first read failed')
    const secondCause = new Error('second read failed')
    first.reject(firstCause)
    second.reject(secondCause)
    await expect(observed.stop()).rejects.toMatchObject({ errors: [firstCause, secondCause] })
    expect(page.listenerCount('console')).toBe(0)
    expect(page.listenerCount('pageerror')).toBe(0)
  })

  it('feeds native console errors and normalized page errors to the same ledger', async () => {
    const page = new EventEmitter()
    const observed = observePageErrors(page)
    observed.ledger.expect(/^console error: Failed to load resource: net::ERR_FAILED$/)
    observed.ledger.expect(/^page error: TypeError: cause: detail$/)
    page.emit('console', {
      type: () => 'error',
      args: () => [],
      text: () => 'Failed to load resource: net::ERR_FAILED',
    })
    const error = new Error('TypeError: cause: detail')
    error.name = 'Unhandled Promise Rejection'
    page.emit('pageerror', error)
    await observed.stop()
    expect(observed.ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('records undeclared errors and ignores other console levels', async () => {
    const page = new EventEmitter()
    const observed = observePageErrors(page)
    for (const type of ['log', 'warn', 'info']) {
      page.emit('console', { type: () => type })
    }
    page.emit('pageerror', new TypeError('an unexpected failure'))
    await observed.stop()
    expect(observed.ledger.verdict()).toEqual({
      unexpected: ['page error: TypeError: an unexpected failure'],
      unmet: [],
    })
  })
})
