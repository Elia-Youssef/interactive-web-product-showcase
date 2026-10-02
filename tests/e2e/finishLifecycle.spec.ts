import { expect, test } from './fixtures'
import { readFinishExpectations } from './finishModel'
import { productLoadBudgetMs, testBodyBudgetMs } from './budgets'
import {
  expectPoll,
  harnessPath,
  harnessProducts,
  waitForProductReady,
  waitForSettledMemory,
} from './productSpecs'

const products = await harnessProducts()

for (const product of products) {
  const expectations = readFinishExpectations(product.slug)
  test(`a full finish cycle of the ${product.slug} sends nothing over the network after ready`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    // Ready is the whole load: the model, the transcoder workers and the
    // texture fetches have all ridden it. From here, a finish switch is
    // materials only, so not one request of any kind may go out while
    // every finish is selected in turn.
    const requestsAfterReady: string[] = []
    page.on('request', (request) => {
      requestsAfterReady.push(request.url())
    })

    for (const finish of product.finishes) {
      await page.getByTestId(`harness-finish-${finish.variant}`).click()
      await expectPoll(page, () => window.__viewer?.finish?.applied ?? null, testBodyBudgetMs).toBe(
        finish.variant,
      )
    }

    expect(
      requestsAfterReady,
      'a finish switch must be materials the load already resolved',
    ).toEqual([])
  })

  test(`the scene of the ${product.slug} holds only the product's own nodes across finishes`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    // The model's own mesh count is the scene's whole truth: the precompile
    // runs on a detached group outside the scene, so a foreign node in the
    // stage scene after the load or after any switch is one too many.
    const ownMeshes = await page.evaluate(() => window.__viewer?.model?.meshes ?? null)
    expect(await page.evaluate(() => window.__harnessSceneMeshes?.() ?? null)).toBe(ownMeshes)

    for (const finish of product.finishes) {
      await page.getByTestId(`harness-finish-${finish.variant}`).click()
      await expectPoll(page, () => window.__viewer?.finish?.applied ?? null, testBodyBudgetMs).toBe(
        finish.variant,
      )
      expect(await page.evaluate(() => window.__harnessSceneMeshes?.() ?? null)).toBe(ownMeshes)
    }
  })

  // Two product loads by design: the contract is the load after a teardown,
  // so the second load is the one under test.
  test(`a remount of the ${product.slug} presents the store's finish with fresh materials`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    // Select the last finish, the one furthest from the file's default,
    // then unmount: the scene release disposes the model and clears the
    // suspense cache, so nothing of the mounted load survives.
    const variants = product.finishes.map((finish) => finish.variant)
    const selected = variants[variants.length - 1]
    if (selected === undefined) {
      throw new Error('a product without a finish has no selection to carry over a remount')
    }
    await page.getByTestId(`harness-finish-${selected}`).click()
    await expectPoll(page, () => window.__viewer?.finish?.applied ?? null, testBodyBudgetMs).toBe(
      selected,
    )

    const toggle = page.getByTestId('remount-product')
    await toggle.click()
    await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
    await expectPoll(page, () => window.__viewer?.finish ?? null, testBodyBudgetMs).toBeNull()

    // Remount: a fresh load, driven straight to the selection the store
    // kept. The full record the finish channel reports names the fresh
    // scene, so it is the new load's own materials, not the file's
    // default and not a survivor of the disposed load.
    await toggle.click()
    await waitForProductReady(page)
    const snapshot = await page.evaluate(() => ({
      model: window.__viewer?.model ?? null,
      finish: window.__viewer?.finish ?? null,
    }))
    expect(snapshot.model?.slug).toBe(product.slug)
    expect(snapshot.finish).toEqual({
      product: product.slug,
      applied: selected,
      requested: selected,
      materials: expectations.get(selected),
    })
  })

  test(`switching the finishes of the ${product.slug} never grows the renderer memory`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    // The mounted model's settled memory is the floor: the load holds the
    // scene, its geometries and every finish material's textures, uploaded
    // by the load-time precompile. A switch swaps materials only. The first
    // pass lets any one-time counter movement happen once per finish, and
    // the second pass, over an all-warm scene, must hold exactly. The
    // teardown proof pins the whole load against the baseline either way.
    const warm = await (async () => {
      let count = await waitForSettledMemory(page)
      for (const finish of product.finishes) {
        await page.getByTestId(`harness-finish-${finish.variant}`).click()
        await expectPoll(
          page,
          () => window.__viewer?.finish?.applied ?? null,
          testBodyBudgetMs,
        ).toBe(finish.variant)
        const afterSwitch = await waitForSettledMemory(page)
        count = {
          geometries: Math.max(count.geometries, afterSwitch.geometries),
          textures: Math.max(count.textures, afterSwitch.textures),
        }
      }
      return count
    })()
    for (const finish of product.finishes) {
      await page.getByTestId(`harness-finish-${finish.variant}`).click()
      await expectPoll(page, () => window.__viewer?.finish?.applied ?? null, testBodyBudgetMs).toBe(
        finish.variant,
      )
      const afterSwitch = await waitForSettledMemory(page)
      expect(afterSwitch.geometries, `geometries after switching to '${finish.variant}'`).toBe(
        warm.geometries,
      )
      expect(afterSwitch.textures, `textures after switching to '${finish.variant}'`).toBe(
        warm.textures,
      )
    }
  })

  test(`the load of the ${product.slug} uploads every finish: the first switch moves no counter`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    const atReady = await waitForSettledMemory(page)
    const variants = product.finishes.map((finish) => finish.variant)
    const selected = variants[variants.length - 1]
    if (selected === undefined) {
      throw new Error('a product without a finish has no switch to measure')
    }
    await page.getByTestId(`harness-finish-${selected}`).click()
    await expectPoll(page, () => window.__viewer?.finish?.applied ?? null, testBodyBudgetMs).toBe(
      selected,
    )
    const afterSwitch = await waitForSettledMemory(page)
    expect(afterSwitch.geometries, 'geometries after the first switch').toBe(atReady.geometries)
    expect(afterSwitch.textures, 'textures after the first switch').toBe(atReady.textures)
  })
}
