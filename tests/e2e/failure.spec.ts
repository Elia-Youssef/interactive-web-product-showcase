import { initFailureReason } from '../../src/lib/renderer/initFailure'
import { backendQueryParam, parseBackendRequest } from '../../src/lib/renderer/request'
import { expect, test } from './fixtures'

// A query with a value the parser does not allow, built from the parser's
// own parameter name.
const bogusQuery = `?${new URLSearchParams({ [backendQueryParam]: 'bogus' }).toString()}`

test('an unknown backend parameter fails with the reason in a visible alert', async ({ page }) => {
  // The expected reason is the parser's own verdict for this exact query, so
  // the spec repeats none of the contract's words.
  const parsed = parseBackendRequest(bogusQuery)
  if (parsed.kind !== 'invalid') {
    throw new Error('the bogus backend request must parse as invalid')
  }

  await page.goto(`/${bogusQuery}`)

  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('failed')
  await expect.poll(() => page.evaluate(() => window.__viewer?.failure)).toBe(parsed.reason)

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText(parsed.reason)
})

// The sentence prefix the init failure builder owns, derived from the
// builder itself so the spec repeats none of its words: the reason for a
// probe cause, cut at the probe.
const probeReason = initFailureReason(new Error('PROBE'))
const startFailurePrefix = probeReason.slice(0, probeReason.indexOf('PROBE'))

test('a renderer that cannot start on either backend fails with a visible alert', async ({
  page,
  backendPath,
  consoleGate,
}) => {
  // Take both backends away before any page script runs: no WebGPU adapter,
  // and a WebGL2 context that never creates. The automatic selection has
  // nothing left to fall back to. The stub is page-side JavaScript, handed
  // over as source, so the DOM typings of the spec stay out of its way.
  await page.addInitScript({
    content: `
      Object.defineProperty(Navigator.prototype, 'gpu', {
        get: () => undefined,
        configurable: true,
      })
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl2') {
          return null
        }
        return originalGetContext.call(this, type, ...rest)
      }
    `,
  })

  // The rejected factory surfaces exactly once as React hands it to the
  // error boundary; that framework line is the declared error below.
  consoleGate.expectError(/The above error occurred in the <CanvasImpl> component/, {
    times: 1,
  })

  await page.goto(backendPath)

  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('failed')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.failure))
    .toContain(startFailurePrefix)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(startFailurePrefix)
})
