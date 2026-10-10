import { expect, test } from './fixtures'
import type { callbacksAfterUnmount } from '../fixtures/motionLifetime.fixtures'

test('motion callbacks end with the real React effect, including instant and finished animations', async ({
  page,
}) => {
  await page.goto('/gallery.html')
  const results = await page.evaluate(async (fixturePath) => {
    const fixture: { callbacksAfterUnmount: typeof callbacksAfterUnmount } = await import(
      fixturePath
    )
    const results: {
      phase: string
      reducedMotion: boolean
      motion: string
      callbacks: string[]
    }[] = []
    for (const phase of ['covering', 'revealing'] as const) {
      for (const reducedMotion of [false, true]) {
        for (const motion of ['empty', 'finished', 'pending'] as const) {
          results.push({
            phase,
            reducedMotion,
            motion,
            callbacks: await fixture.callbacksAfterUnmount({ phase, reducedMotion, motion }),
          })
        }
      }
    }
    return results
  }, '/tests/fixtures/motionLifetime.fixtures.tsx')
  expect(results).toHaveLength(12)
  for (const result of results) {
    expect(result.callbacks, JSON.stringify(result)).toEqual([])
  }
})
