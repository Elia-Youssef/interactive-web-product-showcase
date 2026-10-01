import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { harnessStageBox, lookHarnessPath } from './lookHarness'
import type { RegionBox } from './stagePixels'
import { decodeScreenshotRGBA } from './stagePixels'
import {
  boxChannelSum,
  captureStage,
  countDifferingPixels,
  countDifferingPixelsByDirection,
} from './lookPixels'
import { expectPoll, harnessProducts, waitForProductReady } from './productSpecs'
import { settledStage } from './stageSettle'

// The look overrides, driven through the harness look parameter and proven
// with pixels on every matrix project. Every comparison is exact: no region
// smaller than the stage canvas box, no per-channel tolerance and no tuned
// margin. Each effect is read against the run's own measured noise, which
// the test captures itself: two shots of one page at rest (the in-page
// determinism pair) and two loads of the same look (the cross-load pair). An
// at-rest frame of the same scene is deterministic per engine, so both pairs
// read zero differing pixels on every matrix project, and any nonzero noise
// would make the effect comparisons stricter, not looser.
const products = await harnessProducts()

// Loads the harness page for a look, waits for the settled stage, and
// decodes the capture to RGBA.
async function settledDecoded(
  page: Page,
  backendPath: string,
  slug: string,
  look?: unknown,
): Promise<{ decoded: Awaited<ReturnType<typeof decodeScreenshotRGBA>>; box: RegionBox }> {
  await page.goto(lookHarnessPath(backendPath, slug, look))
  await waitForProductReady(page)
  // The ready report marks the settled frame; the settle wait then drains
  // every load-frame debt and the dev HUD's rolling window, so at rest
  // nothing renders after the wait and the masked HUD sits at its rest
  // text: every capture of the run masks the same box.
  await settledStage(page)
  const box = await harnessStageBox(page)
  const decoded = await decodeScreenshotRGBA(page, await captureStage(page))
  return { decoded, box }
}

// Captures the same page again, for the in-page determinism pair: the
// presented frame is at rest, so any differing pixel is the engine's own
// capture noise.
async function determinismPair(
  page: Page,
): Promise<Awaited<ReturnType<typeof decodeScreenshotRGBA>>> {
  return decodeScreenshotRGBA(page, await captureStage(page))
}

for (const product of products) {
  const prefix = `the ${product.slug} look`

  test(`${prefix} overrides are applied when it reports ready`, async ({ page, backendPath }) => {
    await page.goto(
      lookHarnessPath(backendPath, product.slug, {
        exposure: 2,
        environmentIntensity: 0,
        environmentRotationDeg: 180,
        shadowOpacity: 0.5,
      }),
    )
    await waitForProductReady(page)

    await expectPoll(page, () => {
      const look = window.__viewer?.look ?? null
      if (look === null) {
        return null
      }
      return {
        exposure: look.exposure,
        environmentIntensity: look.environmentIntensity,
        environmentRotationDeg: look.environmentRotationDeg,
        shadow: look.shadow,
      }
    }).toEqual({
      exposure: 2,
      environmentIntensity: 0,
      environmentRotationDeg: 180,
      shadow: {
        opacity: 0.5,
        transparent: true,
        depthWrite: false,
      },
    })
  })

  test(`${prefix} exposure 2 against 1 brightens the stage beyond its noise`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(120_000)
    const reference = await settledDecoded(page, backendPath, product.slug)
    const again = await determinismPair(page)
    const reload = await settledDecoded(page, backendPath, product.slug)
    const exposed = await settledDecoded(page, backendPath, product.slug, { exposure: 2 })

    const inPage = countDifferingPixels(reference.decoded, again, reference.box)
    const crossLoad = countDifferingPixels(reference.decoded, reload.decoded, reference.box)
    const effect = countDifferingPixels(exposed.decoded, reference.decoded, exposed.box)

    // The effect must exceed both noise references the run measured, not a
    // fixed number: a determinism pair and a cross-load pair of the same
    // look, captured in this very test.
    expect(
      effect.count,
      'exposure 2 must change the frame beyond the in-page determinism pair',
    ).toBeGreaterThan(inPage.count)
    expect(
      effect.count,
      'exposure 2 must change the frame beyond a reloaded same look',
    ).toBeGreaterThan(crossLoad.count)

    // And the direction is the look's own: exposure scales the tone mapping
    // up, so the stage's channel sum strictly grows. The sums are integers,
    // so the comparison is exact.
    const referenceSum = boxChannelSum(reference.decoded, reference.box)
    const exposedSum = boxChannelSum(exposed.decoded, exposed.box)
    expect(exposedSum, 'exposure 2 must brighten the stage').toBeGreaterThan(referenceSum)
  })

  test(`${prefix} environment intensity 0 against 1 darkens the stage beyond its noise`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(120_000)
    const reference = await settledDecoded(page, backendPath, product.slug)
    const again = await determinismPair(page)
    const reload = await settledDecoded(page, backendPath, product.slug)
    const unlit = await settledDecoded(page, backendPath, product.slug, {
      environmentIntensity: 0,
    })

    const inPage = countDifferingPixels(reference.decoded, again, reference.box)
    const crossLoad = countDifferingPixels(reference.decoded, reload.decoded, reference.box)
    const effect = countDifferingPixels(unlit.decoded, reference.decoded, unlit.box)

    expect(
      effect.count,
      'intensity 0 must change the frame beyond the in-page determinism pair',
    ).toBeGreaterThan(inPage.count)
    expect(
      effect.count,
      'intensity 0 must change the frame beyond a reloaded same look',
    ).toBeGreaterThan(crossLoad.count)

    // The environment is the lit materials' only light: intensity 0 must
    // darken the stage, never brighten it.
    const referenceSum = boxChannelSum(reference.decoded, reference.box)
    const unlitSum = boxChannelSum(unlit.decoded, unlit.box)
    expect(unlitSum, 'intensity 0 must darken the stage').toBeLessThan(referenceSum)
  })

  test(`${prefix} a rotation of 180 turns the reflections beyond its noise`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(120_000)
    const reference = await settledDecoded(page, backendPath, product.slug)
    const again = await determinismPair(page)
    const reload = await settledDecoded(page, backendPath, product.slug)
    const rotated = await settledDecoded(page, backendPath, product.slug, {
      environmentRotationDeg: 180,
    })

    const inPage = countDifferingPixels(reference.decoded, again, reference.box)
    const crossLoad = countDifferingPixels(reference.decoded, reload.decoded, reference.box)
    const effect = countDifferingPixels(rotated.decoded, reference.decoded, rotated.box)

    // The studio environment is directional, so a half turn moves the
    // highlights across the product.
    expect(
      effect.count,
      'the rotation must change the frame beyond the in-page determinism pair',
    ).toBeGreaterThan(inPage.count)
    expect(
      effect.count,
      'the rotation must change the frame beyond a reloaded same look',
    ).toBeGreaterThan(crossLoad.count)
  })

  test(`${prefix} the shadow darkens, monotonically in its opacity`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(120_000)
    // The shadow can only darken what it covers, and it covers most of the
    // pixels its opacity step moves, so in each pair the frame changes, its
    // channel sum strictly falls, and the darkening mass exceeds the
    // brightening mass. The brightening side is real but small: at the
    // product's antialiased silhouette a pixel is partly product and partly
    // shadow over the backdrop, and the output pass's premultiplied
    // roundtrip through the concave sRGB transfer brightens the product's
    // contribution when the shadow's alpha behind it rises. That silhouette
    // is not separable per pixel without a mask, so the oracle reads the
    // masses, not every pixel's direction.
    const opaque = await settledDecoded(page, backendPath, product.slug, { shadowOpacity: 1 })
    const half = await settledDecoded(page, backendPath, product.slug, { shadowOpacity: 0.5 })
    const none = await settledDecoded(page, backendPath, product.slug, { shadowOpacity: 0 })

    const fullToHalf = countDifferingPixelsByDirection(opaque.decoded, half.decoded, opaque.box)
    expect(
      fullToHalf.count,
      'half the shadow opacity must still change the frame',
    ).toBeGreaterThanOrEqual(1)
    expect(
      fullToHalf.darkenedSum,
      'the shadow growing from 0.5 to 1 must darken more than the silhouette brightens',
    ).toBeGreaterThan(fullToHalf.brightenedSum)
    expect(
      boxChannelSum(opaque.decoded, opaque.box),
      'the stage must darken as the shadow opacity grows from 0.5 to 1',
    ).toBeLessThan(boxChannelSum(half.decoded, half.box))

    const halfToNone = countDifferingPixelsByDirection(half.decoded, none.decoded, half.box)
    expect(
      halfToNone.count,
      'dropping the shadow opacity to 0 must still change the frame',
    ).toBeGreaterThanOrEqual(1)
    expect(
      halfToNone.darkenedSum,
      'the shadow growing from 0 to 0.5 must darken more than the silhouette brightens',
    ).toBeGreaterThan(halfToNone.brightenedSum)
    expect(
      boxChannelSum(half.decoded, half.box),
      'the stage must darken as the shadow opacity grows from 0 to 0.5',
    ).toBeLessThan(boxChannelSum(none.decoded, none.box))
  })
}
