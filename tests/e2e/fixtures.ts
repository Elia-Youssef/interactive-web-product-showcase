import { expect, test as base } from '@playwright/test'
import type { BrowserName, ChannelSpec } from './matrix'
import type { ErrorTimes } from './errorLedger'
import { createErrorLedger } from './errorLedger'
import type { RendererBackend } from '../../src/lib/renderer/backend'
import { e2eBaseURL } from '../../tooling/devHost.ts'
import { resolveDevPort } from '../../tooling/devPort.ts'

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

type E2EWorkerFixtures = E2EOptions & {
  channelContract: void
}

type E2ETestFixtures = {
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

export const test = base.extend<E2ETestFixtures, E2EWorkerFixtures>({
  // The matrix row values are per-project constants, so they are worker
  // fixtures: the channel contract below reads them at worker scope.
  backendPath: [
    async ({}, use) => use(missingOption('backendPath')),
    { option: true, scope: 'worker' },
  ],
  expectedBackend: [
    async ({}, use) => use(missingOption('expectedBackend')),
    { option: true, scope: 'worker' },
  ],
  expectedBrowserName: [
    async ({}, use) => use(missingOption('expectedBrowserName')),
    { option: true, scope: 'worker' },
  ],
  expectedChannel: [undefined, { option: true, scope: 'worker' }],
  hostsVisualBaselines: [false, { option: true, scope: 'worker' }],
  // The branded channel contract, once per worker: the branded build must
  // advertise its channel in navigator.userAgentData.brands, which the
  // bundled Chromium build never claims. That API exists only in a secure
  // context, so the read runs on the app origin, on a probe page of its own.
  // The page under test is never navigated for it: its traffic belongs to
  // the test body alone.
  channelContract: [
    async ({ browser, backendPath, expectedChannel }, use) => {
      if (expectedChannel !== undefined) {
        // The probe page comes without its project's context, so the app URL
        // is resolved here, from the same port pool and loopback address the
        // server binds and the config's baseURL is built from.
        const appURL = new URL(backendPath, e2eBaseURL(resolveDevPort(process.env))).toString()
        const probe = await browser.newPage()
        await probe.goto(appURL)
        const brands = await probe.evaluate(
          () => navigator.userAgentData?.brands.map((entry) => entry.brand) ?? [],
        )
        expect(
          brands,
          `the ${expectedChannel.name} channel must launch its branded build, not the bundled one`,
        ).toContain(expectedChannel.brand)
        await probe.close()
      }
      await use()
    },
    { scope: 'worker', auto: true },
  ],
  // The browser contract: what actually launched must be what the project's
  // matrix row says. A misrouted project fails every test it runs. The page
  // under test must reach the body with no document of its own: a document
  // the fixtures left behind keeps issuing requests after the body's own
  // navigation starts, and every spec that observes the page's traffic
  // counts them as its own. The guard pins the blank start, so the first
  // fixture that navigates this page fails every test of the run.
  matrixContract: [
    async ({ page, browser, expectedBrowserName }, use) => {
      expect(
        browser.browserType().name(),
        'the launched browser must match the project matrix',
      ).toBe(expectedBrowserName)
      expect(
        page.url(),
        'the page under test must reach the body at about:blank, not on a fixture document',
      ).toBe('about:blank')
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
