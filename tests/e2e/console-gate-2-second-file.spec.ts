import { test } from './fixtures'

// This file exists to prove the clean-page gate. Every test here is a gate
// proof, and the failing ones are declared with test.fail: if the gate ever
// regresses, they pass, the expected-fail declaration flags it, and the run
// goes red. The gate-proof project runs on one worker and this file sorts
// after console-gate-1-first-file.spec.ts, so it always loads second on that
// worker.

test('gate proof: a console error in the second spec file on one worker fails the test', async ({
  page,
}) => {
  test.fail()
  // The waiter is registered before the cause, so the event cannot slip past
  // it: the teardown then sees the recorded error and fails the test.
  const consoleError = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted gate proof console error')
  })
  await consoleError
})

test('gate proof: a page error in the second spec file on one worker fails the test', async ({
  page,
}) => {
  test.fail()
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('planted gate proof page error')
    }, 0)
  })
  await page.waitForEvent('pageerror')
})

test('gate proof: an expectError that never appears fails the test', async ({ consoleGate }) => {
  test.fail()
  consoleGate.expectError(/this error never appears/)
})

test('gate proof: an expectError consumes the console error it announces', async ({
  page,
  consoleGate,
}) => {
  consoleGate.expectError(/planted deliberate error/)
  const consoleError = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted deliberate error')
  })
  await consoleError
})

test('gate proof: an expectError consumes a console error that already happened', async ({
  page,
  consoleGate,
}) => {
  const consoleError = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted deliberate error')
  })
  await consoleError
  consoleGate.expectError(/planted deliberate error/)
})

test('gate proof: an expectError with a count consumes exactly that many', async ({
  page,
  consoleGate,
}) => {
  consoleGate.expectError(/planted deliberate error/, { times: 2 })
  const first = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  const second = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted deliberate error')
    console.error('planted deliberate error')
  })
  await first
  await second
})

test('gate proof: an expectError that sees fewer errors than its count fails', async ({
  page,
  consoleGate,
}) => {
  test.fail()
  consoleGate.expectError(/planted deliberate error/, { times: 2 })
  const consoleError = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted deliberate error')
  })
  await consoleError
})

test('gate proof: an expectError that sees more errors than its count fails', async ({
  page,
  consoleGate,
}) => {
  test.fail()
  consoleGate.expectError(/planted deliberate error/, { times: 1 })
  const first = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  const second = page.waitForEvent('console', {
    predicate: (message) => message.type() === 'error',
  })
  await page.evaluate(() => {
    console.error('planted deliberate error')
    console.error('planted deliberate error')
  })
  await first
  await second
})

test('gate proof: a one-or-more expectError consumes every matching error', async ({
  page,
  consoleGate,
}) => {
  consoleGate.expectError(/planted deliberate error/, { times: 'one-or-more' })
  const seen: Promise<unknown>[] = []
  for (let index = 0; index < 3; index += 1) {
    seen.push(page.waitForEvent('console', { predicate: (message) => message.type() === 'error' }))
  }
  await page.evaluate(() => {
    for (let index = 0; index < 3; index += 1) {
      console.error('planted deliberate error')
    }
  })
  await Promise.all(seen)
})
