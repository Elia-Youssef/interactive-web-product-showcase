import { expect, test } from './fixtures'
import {
  expectPoll,
  harnessPath,
  harnessProduct,
  waitForProductReady,
  waitForSettledMemory,
  waitForStageWarm,
  type RendererMemory,
} from './productSpecs'

// Three mount-unmount cycles in one page. The stage's warm-up makes its
// renderer-owned textures exist before the baseline is read, so the proof
// is exact: after every teardown, geometries and textures equal the
// baseline, and repeating the cycle proves nothing accumulates per cycle.
test('unmounting the product returns the renderer memory to its baseline, every cycle', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(240_000)
  const product = harnessProduct()
  await page.goto(harnessPath(backendPath, product.slug))

  await waitForStageWarm(page)
  const toggle = page.getByTestId('remount-product')

  // The page mounts the product to start with, so the first teardown brings
  // the stage to the empty state the baseline reads: its renderer-owned
  // textures (the tone-mapping framebuffer target and the IBL lookup
  // three's node system keeps for the renderer's lifetime) exist and never
  // leave, so this is the one baseline every cycle must return to, exactly.
  await toggle.click()
  await expectPoll(page, () => window.__viewer?.product).toBe('idle')
  const baseline = await waitForSettledMemory(page)

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    // Mount: a fresh load every time, because each teardown clears the
    // suspense cache, and its resources sit on top of the empty baseline.
    await toggle.click()
    await waitForProductReady(page)
    const mounted = await waitForSettledMemory(page, baseline)
    expect(mounted.geometries).toBeGreaterThan(baseline.geometries)
    expect(mounted.textures).toBeGreaterThan(baseline.textures)

    // Teardown: every geometry and texture the product held goes, and the
    // counts return to the exact baseline. Nothing is allowed to lag: one
    // leaked texture per cycle is the smallest leak there is, and the
    // equality catches it.
    await toggle.click()
    await expectPoll(page, () => window.__viewer?.product).toBe('idle')
    const afterTeardown = await waitForSettledMemory(page)
    expectToEqualBaseline(afterTeardown, baseline, cycle)
  }
})

function expectToEqualBaseline(
  afterTeardown: RendererMemory,
  baseline: RendererMemory,
  cycle: number,
): void {
  expect(afterTeardown.geometries, `geometries after teardown of cycle ${cycle}`).toBe(
    baseline.geometries,
  )
  expect(afterTeardown.textures, `textures after teardown of cycle ${cycle}`).toBe(
    baseline.textures,
  )
}
