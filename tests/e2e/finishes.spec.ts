import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { readFinishExpectations } from './finishModel'
import { measureFinishChange } from './finishPixels'
import { settledFrames } from './stageSettle'
import { waitForProductReady } from './productSpecs'

// The finish evidence on the app itself: the collection's first product,
// whose swatches are the panel's own. The expected materials are read from
// the shipped model file, and the applied finish from the scene graph after
// the switch's settle, so the file, the plan and the model are held against
// each other with no hand-typed expectation. Each project's backendPath is
// the app URL with its own backend mode.

const product = (await loadCollection()).first
const expectations = readFinishExpectations(product.slug)

// The relative luminance of a manifest swatch, the word the schema keeps
// for the UI dot and this spec reads for the direction of the change: the
// darker swatch must land on the darker pixels.
function swatchLuminance(swatch: string): number {
  const channel = (at: number): number => parseInt(swatch.slice(at, at + 2), 16) / 255
  return 0.2126 * channel(1) + 0.7015 * channel(3) + 0.0722 * channel(5)
}

test('the product is on its default finish at ready, read in one snapshot', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForProductReady(page)

  // Ready means the presentation's settle recorded its frame; the
  // controller's precompile, application and settle are queued ahead of
  // that settle, so the same read carries the applied finish. One atomic
  // read, so neither field can be observed without the other.
  const snapshot = await page.evaluate(() => ({
    product: window.__viewer?.product ?? null,
    finish: window.__viewer?.finish ?? null,
  }))

  const [defaultVariant, defaultRecord] = [...expectations.entries()][0] ?? []
  expect(defaultVariant).toBeDefined()
  expect(snapshot.product).toBe('ready')
  expect(snapshot.finish).toEqual({
    product: product.slug,
    applied: defaultVariant,
    requested: defaultVariant,
    materials: defaultRecord,
  })
})

test(`clicking each swatch of ${product.slug} applies exactly that finish's materials, and the stage rests`, async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForProductReady(page)

  for (const finish of product.finishes) {
    const expected = expectations.get(finish.variant)
    expect(expected, `the shipped model declares the variant '${finish.variant}'`).toBeDefined()

    await page.getByRole('button', { name: finish.label }).click()
    await expect
      .poll(() => page.evaluate(() => window.__viewer?.finish ?? null))
      .toEqual({
        product: product.slug,
        applied: finish.variant,
        requested: finish.variant,
        materials: expected,
      })

    // The switch is a scene mutation: at rest the settle has presented it
    // and no frame renders between two reads.
    const atRest = await settledFrames(page)
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)).toBe(atRest)
  }
})

// The direction proof runs on every engine. At rest the settle presents the
// settled state twice, so a capture taken after it shows the applied finish
// everywhere: the engines' compositors hold the canvas one present behind at
// rest, and the second present is the one the capture sees.
test('the finish change repaints the model in the manifest direction, past the noise of its own run', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForProductReady(page)

  const [defaultFinish, otherFinish] = product.finishes
  if (defaultFinish === undefined || otherFinish === undefined) {
    throw new Error('a product with one finish has no finish change to measure')
  }
  const defaultIsLighter =
    swatchLuminance(defaultFinish.swatch) > swatchLuminance(otherFinish.swatch)

  // Three captures: two back-to-back at the default finish, one after
  // switching to the other. The first two are this run's noise reference:
  // same state, same run, so any differing pixel is capture jitter, and a
  // jittery run proves no direction. The switch pair must differ: a capture
  // that lags the state reads the default and pairs up identical, which
  // means the switch never reached the pixels, so it fails instead of
  // passing a finish that did not paint.
  await settledFrames(page)
  // The dev HUD shows live timings, so it is masked: the captures pin the
  // stage, not a measurement.
  const capture = (): Promise<Uint8Array> =>
    page.screenshot({ mask: [page.getByTestId('dev-hud')], maskColor: '#000000' })
  const atDefault = await capture()
  const atDefaultAgain = await capture()
  await page.getByRole('button', { name: otherFinish.label }).click()
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.finish?.applied ?? null))
    .toBe(otherFinish.variant)
  await settledFrames(page)
  const atOther = await capture()

  const stageBox = await page.locator('[data-slot="stage"]').boundingBox()
  if (stageBox === null) {
    throw new Error('the stage slot must have a bounding box')
  }
  const noise = await measureFinishChange(page, atDefault, atDefaultAgain, stageBox)
  expect(
    noise.changedPixels,
    'the captures jitter at the same state, so no pixel count of this run can prove a direction',
  ).toBe(0)
  const change = await measureFinishChange(page, atDefault, atOther, stageBox)
  expect(
    change.changedPixels,
    'the capture after the switch holds the previous present, so the applied finish never reached the pixels',
  ).toBeGreaterThan(0)
  // The repaint is measured against this run's own noise pair, not against
  // a tuned count: the switch must change strictly more than the
  // same-finish pair, which is pixel-exact.
  expect(change.changedPixels).toBeGreaterThan(noise.changedPixels)
  // And over the surface the change covers, the darker manifest finish
  // must sit on the darker pixels.
  if (defaultIsLighter) {
    expect(change.meanSecond).toBeLessThan(change.meanFirst)
  } else {
    expect(change.meanFirst).toBeLessThan(change.meanSecond)
  }
})
