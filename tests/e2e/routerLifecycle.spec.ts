import { expect, test } from './fixtures'

// An unlisted spec is general: the tier table runs it on the full projects.
// The dev entry is outside the production build's index.html input graph.
test('real React roots isolate their routers and release them after StrictMode replay', async ({
  page,
}) => {
  await page.goto('/router-lifecycle.html')
  const proofs = await page.evaluate(`(async () => {
    const fixture = await import('/src/app/router-lifecycle/routerLifecycle.fixtures.tsx')
    try {
      return await fixture.proveRouterLifecycle()
    } catch (error) {
      if (error instanceof AggregateError) {
        throw new Error(error.errors.map((entry) => entry.stack ?? String(entry)).join(' | '))
      }
      throw error
    }
  })()`)
  expect(proofs).toEqual([
    'StrictMode replay',
    'independent context readers',
    'bound navigate and RouteLink',
    'query-only popstate',
    'unmount clears retained registrations',
    'surviving owner',
  ])
})
