import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { harnessStageBox } from './e2eViewport'
import { waitForExplodeRestingAt } from './explodeRest'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { readProductCameraFacts } from './productCamera'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { readScrubMarkerFacts, SCRUB_TARGETS } from './scrubMarkerFacts'
import { completedPresentation } from './presentationCompletion'
import { siteCopy } from '../../src/lib/copy/site'
import type { Product } from '../../src/lib/product'

// An open card while the explode moves its marker's anchor: the card shows
// exactly when its marker shows, on every presented frame of a scrub from
// the assembled pose to fully exploded. The harness probe observes every
// overlay pass after the card has placed itself, so each sample is one
// frame's final placements with the progress that frame applied. The
// subjects are the hotspots whose marker the scrub hides and shows from
// the home view, by the shipped model's own facts, so the proof can fail:
// a hotspot whose marker never hides could not tell a card that ignores
// it. The set is guarded at collection, so no subject means a failure,
// never a silent pass.

const extent = await readMarkerExtentTokens()
const hosts = [
  { slot: 'floating', box: harnessStageBox },
  { slot: 'docked', box: { width: 390, height: 844 } },
] as const
const subjects: {
  readonly product: Product
  readonly hotspot: Product['hotspots'][number]
  readonly host: (typeof hosts)[number]
}[] = []
for (const host of hosts) {
  for (const product of await harnessProducts()) {
    const views = await readProductCameraFacts(product.slug)
    const facts = await readScrubMarkerFacts(product, views.center, views.home, {
      box: host.box,
      extent,
    })
    for (const hotspot of product.hotspots) {
      const shown = facts.get(hotspot.id) ?? []
      if (shown.includes(true) && shown.includes(false)) {
        subjects.push({ product, hotspot, host })
      }
    }
  }
  if (!subjects.some((subject) => subject.host === host)) {
    throw new Error(
      'no hotspot of the product set hides and shows its marker while the explode scrubs',
    )
  }
}

for (const { product, hotspot, host } of subjects) {
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

  test(`hotspots ${product.slug}: the open ${hotspot.title} ${host.slot} card shows exactly when its marker shows while the explode scrubs open`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 1 }))
    await page.setViewportSize(host.box)
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)
    await completedPresentation(page)

    await markerOf(page, hotspot.title).click()
    await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
    await completedPresentation(page)
    await page.evaluate(() => window.__harnessClearCardVisibilitySamples?.())

    // Each step waits for the pose to rest on its target, frame by frame.
    // The first step leaves the assembled pose, which returns a close-up to
    // home, so the camera settles there before the scrub goes on.
    const slider = page.getByRole('slider', { name: explodeLabel })
    for (const [step, target] of SCRUB_TARGETS.entries()) {
      await slider.fill(String(target))
      await waitForExplodeRestingAt(page, target)
      if (step === 0) {
        await completedPresentation(page)
      }
    }

    const samples = await page.evaluate(() => window.__harnessCardVisibilitySamples?.() ?? null)
    if (samples === null) {
      throw new Error('the harness card probe must be mounted with the product')
    }
    const mismatched = samples.filter((sample) => sample.cardVisible !== sample.markerVisible)
    expect(
      samples.every(
        (sample) =>
          sample.card?.selected === hotspot.id &&
          sample.card.mounted &&
          (sample.card.slot === 'floating' || sample.card.slot === 'docked') &&
          sample.card.bounds.right > sample.card.bounds.left &&
          sample.card.bounds.bottom > sample.card.bounds.top,
      ),
      'every frame records the selected native stage card host and its laid-out geometry',
    ).toBe(true)
    expect(
      samples.some((sample) => sample.card?.slot === host.slot && sample.cardVisible),
      `the scrub must present a shown card in the actual ${host.slot} host`,
    ).toBe(true)
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
