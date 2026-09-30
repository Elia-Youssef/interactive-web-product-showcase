import { expect, test as base } from '@playwright/test'
import type { BrowserName, ChannelSpec } from './matrix'
import type { ErrorTimes } from './errorLedger'
import { createErrorLedger } from './errorLedger'
import type { RendererBackend } from '../../src/lib/renderer/backend'

export type { ChannelSpec } from './matrix'
export type { ErrorTimes } from './errorLedger'

// The matrix options every project carries. They have no defaults on purpose:
// a project that forgets one fails loudly when a spec reaches for it, instead
// of silently testing something else. expectedChannel is the one optional
// option: absence means the project runs the bundled browser build.
export type E2EOptions = {
  backendPath: string
  expectedBackend: RendererBackend
  expectedBrowserName: BrowserName
  expectedChannel?: ChannelSpec
  // Whether this project hosts the committed visual baselines, from the
  // matrix data. Its safe default is false: a project that forgets it only
  // skips baselines, it never tests the wrong thing.
  hostsVisualBaselines: boolean
}

export type ConsoleGate = {
  expectError(pattern: RegExp, options?: { readonly times?: ErrorTimes }): void
}

type E2EFixtures = E2EOptions & {
  matrixContract: void
  consoleGate: ConsoleGate
}

function missingOption(name: string): never {
  throw new Error(`the ${name} option must come from the project matrix (tests/e2e/matrix.ts)`)
}

// navigator.userAgentData is not in the DOM lib yet. The brands list is the
// channel contract's input, typed at the width the check reads.
declare global {
  interface Navigator {
    readonly userAgentData?: { readonly brands: readonly { readonly brand: string }[] }
  }
}

export const test = base.extend<E2EFixtures>({
  backendPath: [async ({}, use) => use(missingOption('backendPath')), { option: true }],
  expectedBackend: [async ({}, use) => use(missingOption('expectedBackend')), { option: true }],
  expectedBrowserName: [
    async ({}, use) => use(missingOption('expectedBrowserName')),
    { option: true },
  ],
  expectedChannel: [undefined, { option: true }],
  hostsVisualBaselines: [false, { option: true }],
  // The browser contract: what actually launched must be what the project's
  // matrix row says, browser type and branded channel included. A misrouted
  // project fails every test it runs. The branded channel proves itself
  // through the brand name the page sees in navigator.userAgentData.brands:
  // the bundled Chromium build never claims it. That API exists only in a
  // secure context, so the check reads it on the page under test instead of
  // the blank page every spec starts on.
  matrixContract: [
    async ({ page, browser, backendPath, expectedBrowserName, expectedChannel }, use) => {
      expect(
        browser.browserType().name(),
        'the launched browser must match the project matrix',
      ).toBe(expectedBrowserName)
      if (expectedChannel !== undefined) {
        await page.goto(backendPath)
        const brands = await page.evaluate(
          () => navigator.userAgentData?.brands.map((entry) => entry.brand) ?? [],
        )
        expect(
          brands,
          `the ${expectedChannel.name} channel must launch its branded build, not the bundled one`,
        ).toContain(expectedChannel.brand)
      }
      await use()
    },
    { auto: true },
  ],
  // Every spec gets the clean-page gate for free: a console error or a page
  // error fails the test, whatever it set out to check. The assertion lives
  // in the fixture teardown, not in an afterEach hook: a module-level hook
  // lands only in the first spec file each worker loads, while every test in
  // every file instantiates this fixture. The bookkeeping lives in the pure
  // errorLedger module; this fixture only feeds it from the page events and
  // asserts on its verdict. Deliberate errors are declared with expectError,
  // with an explicit count for failures that log more than once: too few
  // matches fail the test, and so do too many when the count is a number.
  consoleGate: [
    async ({ page }, use) => {
      const ledger = createErrorLedger()

      page.on('console', (message) => {
        if (message.type() === 'error') {
          ledger.record(`console error: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => {
        ledger.record(`page error: ${error.message}`)
      })

      await use({
        expectError(pattern, options): void {
          ledger.expect(pattern, options)
        },
      })

      const verdict = ledger.verdict()
      expect(verdict.unexpected, 'the page stayed clean during the test').toEqual([])
      expect(
        verdict.unmet,
        'every expected page error appeared the declared number of times',
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
