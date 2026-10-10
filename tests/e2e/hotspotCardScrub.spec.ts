import { hotspotTestProducts } from './hotspotTestProducts'
import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { harnessStageBox } from './e2eViewport'
import { waitForExplodeRestingAt } from './explodeRest'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { readProductCameraFacts } from './productCamera'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { readScrubMarkerFacts, SCRUB_TARGETS } from './scrubMarkerFacts'
import { settledFrames } from './stageSettle'
import { siteCopy } from '../../src/lib/copy/site'

// An open card while the explode moves its marker's anchor: the card shows
// exactly when its marker shows, on every presented frame of a scrub from
// the assembled pose to fully exploded. The harness probe observes every
// overlay pass after the card has placed itself, so each sample is one
// frame's final placements with the progress that frame applied. The
// subjects are the hotspots whose marker the scrub hides and shows from
// the home view, by the shipped model's own facts, so the proof can fail:
// a hotspot whose marker never hides could not tell a card that ignores
// it. The set is guarded at run time, so no subject means a failure,
// never a silent pass.

const extent = await readMarkerExtentTokens()
const products = hotspotTestProducts(await harnessProducts(), 'card scrub proof')
const subjects = products.flatMap((product) =>
  product.hotspots.map((hotspot) => ({ product, hotspot })),
)
const selected = new Set<string>()
test.beforeAll(async () => {
  for (const product of products) {
    const views = await readProductCameraFacts(product.slug)
    const facts = await readScrubMarkerFacts(product, views.center, views.home, {
      box: harnessStageBox,
      extent,
    })
    for (const hotspot of product.hotspots) {
      const shown = facts.get(hotspot.id) ?? []
      if (shown.includes(true) && shown.includes(false)) {
        selected.add(`${product.slug}/${hotspot.id}`)
      }
    }
  }
  if (selected.size === 0) {
    throw new Error(
      'no hotspot of the product set hides and shows its marker while the explode scrubs',
    )
  }
})

for (const { product, hotspot } of subjects) {
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

  test(`hotspots ${product.slug}: the open ${hotspot.title} card shows exactly when its marker shows while the explode scrubs open`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 1 }))
    test.skip(
      !selected.has(`${product.slug}/${hotspot.id}`),
      'the marker does not both hide and show during the scrub',
    )
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)
    await settledFrames(page)

    await markerOf(page, hotspot.title).click()
    await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
    await settledFrames(page)
    await page.evaluate(() => window.__harnessClearCardVisibilitySamples?.())

    // Each step waits for the pose to rest on its target, frame by frame.
    // The first step leaves the assembled pose, which returns a close-up to
    // home, so the camera settles there before the scrub goes on.
    const slider = page.getByRole('slider', { name: explodeLabel })
    for (const [step, target] of SCRUB_TARGETS.entries()) {
      await slider.fill(String(target))
      await waitForExplodeRestingAt(page, target)
      if (step === 0) {
        await settledFrames(page)
      }
    }

    const samples = await page.evaluate(() => window.__harnessCardVisibilitySamples?.() ?? null)
    if (samples === null) {
      throw new Error('the harness card probe must be mounted with the product')
    }
    const mismatched = samples.filter((sample) => sample.cardVisible !== sample.markerVisible)
    expect(
      mismatched,
      'every presented frame shows the card exactly when its marker shows',
    ).toEqual([])
    expect(
      samples.some((sample) => sample.markerVisible),
      'the scrub must present frames with the marker shown',
    ).toBe(true)
    expect(
      samples.some((sample) => !sample.markerVisible),
      'the scrub must present frames with the marker hidden',
    ).toBe(true)
  })
}
