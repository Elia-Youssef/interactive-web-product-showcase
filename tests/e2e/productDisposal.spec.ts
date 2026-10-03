import { expect, test } from './fixtures'
import { productLoadBudgetMs, testBodyBudgetMs, testBudgetMs } from './budgets'
import {
  expectPoll,
  harnessPath,
  harnessProducts,
  waitForProductReady,
  waitForSettledMemory,
  waitForStageWarm,
  type RendererMemory,
} from './productSpecs'

const products = await harnessProducts()

for (const product of products) {
  // Three mount-unmount cycles in one page. The stage's warm-up makes its
  // renderer-owned textures exist before the baseline is read, so the proof
  // is exact: after every teardown, geometries and textures equal the
  // baseline, and repeating the cycle proves nothing accumulates per cycle.
  // Every cycle switches through the product's finishes first, so the
  // finish materials the load resolved ride the same teardown.
  test(`unmounting the ${product.slug} returns the renderer memory to its baseline, every cycle`, async ({
    page,
    backendPath,
  }) => {
    // The first presentation plus three remount loads, and the memory
    // settles between them: the budget module's derivation for that count.
    test.setTimeout(testBudgetMs({ productLoads: 4 }))
    await page.goto(harnessPath(backendPath, product.slug))

    await waitForStageWarm(page)
    const toggle = page.getByTestId('remount-product')

    // The first presentation sets the model report every remount must bring
    // back: the same slug and the same counts, measured from a fresh load.
    await waitForProductReady(page)
    const presented = await page.evaluate(() => window.__viewer?.model ?? null)
    expect(presented?.slug).toBe(product.slug)

    // The page mounts the product to start with, so the first teardown brings
    // the stage to the empty state the baseline reads: its renderer-owned
    // textures (the tone-mapping framebuffer target and the IBL lookup
    // three's node system keeps for the renderer's lifetime) exist and never
    // leave, so this is the one baseline every cycle must return to, exactly.
    await toggle.click()
    await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
    const baseline = await waitForSettledMemory(page)

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      // Mount: a fresh load every time, because each teardown forgets the
      // stage's load of the model, and its resources sit on top of the empty
      // baseline.
      await toggle.click()
      await waitForProductReady(page)
      expect(await page.evaluate(() => window.__viewer?.model ?? null)).toEqual(presented)
      const mounted = await waitForSettledMemory(page, baseline)
      expect(mounted.geometries).toBeGreaterThan(baseline.geometries)
      expect(mounted.textures).toBeGreaterThan(baseline.textures)

      // Cycle every finish before the teardown, so the resources the
      // switches touched ride the same teardown. The settled count over a
      // switch is the lifecycle spec's proof; here every applied finish
      // must simply be on the product the teardown then releases.
      for (const finish of product.finishes) {
        await page.getByTestId(`harness-finish-${finish.variant}`).click()
        await expectPoll(
          page,
          () => window.__viewer?.finish?.applied ?? null,
          testBodyBudgetMs,
        ).toBe(finish.variant)
      }

      // Teardown: every geometry, texture and finish material the product
      // held goes, and the counts return to the exact baseline. Nothing is
      // allowed to lag: one leaked texture per cycle is the smallest leak
      // there is, and the equality catches it.
      await toggle.click()
      await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
      expect(await page.evaluate(() => window.__viewer?.model ?? null)).toBeNull()
      expect(await page.evaluate(() => window.__viewer?.finish ?? null)).toBeNull()
      const afterTeardown = await waitForSettledMemory(page)
      expectToEqualBaseline(afterTeardown, baseline, cycle)
    }
  })
}

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
