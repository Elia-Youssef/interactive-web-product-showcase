import { test } from './fixtures'
import { testBudgetMs } from './budgets'
import { remountProduct } from './productFailureChannel'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { settledStageCapture } from './stageCapture'
import { decodeScreenshotRGBA, type DecodedScreenshot } from './stagePixels'

// One settled state per product, as a stability smoke. A clean load and a
// remount of the same product under the same renderer must present the same
// image, pixel for pixel, so a settled state that flips between loads fails
// here for every product and every engine. Four loads do not by themselves
// prove that no material renders another material's uniform values: whether
// such a crossing appears depends on the loads, so this spec can pass on
// broken code. The deterministic proof of that class builds the materials
// through the renderer's real node builder in finishMaterialsBuild.test.ts;
// this spec stays as the settled-image smoke for the whole collection.
//
// The loads mix page mounts and harness remounts: both load the model fresh
// through the stage's own cache policy, and both are ways a visitor arrives
// at the product. The equality is exact because the settled captures cover
// the same box at rest; the harness controls and the dev HUD are masked.

const loadsPerProduct = 4

function differingPixels(base: DecodedScreenshot, other: DecodedScreenshot): number {
  if (base.width !== other.width || base.height !== other.height) {
    return -1
  }
  let differing = 0
  for (let index = 0; index < base.bytes.length; index += 1) {
    if (base.bytes[index] !== other.bytes[index]) {
      differing += 1
    }
  }
  return differing
}

for (const product of await harnessProducts()) {
  test(`the settled image of ${product.slug} is identical across clean loads and remounts`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: loadsPerProduct }))

    const captures: DecodedScreenshot[] = []
    for (let load = 0; load < loadsPerProduct; load += 1) {
      if (load % 2 === 0) {
        await page.goto(harnessPath(backendPath, product.slug))
      } else {
        await remountProduct(page)
      }
      await waitForProductReady(page)
      captures.push(
        await decodeScreenshotRGBA(page, await settledStageCapture(page, ['harnessControls'])),
      )
    }

    const [base, ...rest] = captures
    if (base === undefined) {
      throw new Error('the settled captures are missing')
    }
    for (const [load, capture] of rest.entries()) {
      const differing = differingPixels(base, capture)
      test
        .expect(
          differing,
          `load ${load} of ${product.slug} differs from the first clean load in ${differing} channels`,
        )
        .toBe(0)
    }
  })
}
