import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { waitForExplodeRestingAt } from './explodeRest'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { readScrubMarkerFacts } from './scrubMarkerFacts'
import { expectProduct, productPathOf } from './collectionFacts'
import { shippedProducts } from './productSpecs'
import { settledFrames } from './stageSettle'
import { expectOrbitAtRest, readCamera, stageAspectOfCanvas } from './stageCamera'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { flowFacts, type HotspotFlow } from './hotspotFlowFacts'
import { referenceLayouts, stageBoxOf } from './layoutContracts'
import { expectCardWhereTheLayoutPutsIt } from './hotspotCardOracle'
import type { AuthoredView } from './productCamera'
import type { MarkerViews } from './productMarkerViews'
import { expectMarkerClearOfCard, openCardOf, placedMarkerTitles } from './hotspotCardChecks'

// The open card never gets in the way, on the app page at every layout
// size: for every hotspot, in every authored view it can be open in (home,
// and its close-up when it has one), every placed marker stays clear of the
// card (its hit area answers hit testing with the marker, a pointer press
// lands on it, its focus ring is drawn where the card is not) and the open
// marker stays selected. Where the layout floats cards, a floating card
// hangs beside its marker inside the stage; where it docks them (the
// phone's sheet), the card is in the panel. A close-up hotspot opens at
// home the way the flow allows it: close-ups apply only to the assembled
// product, so the hotspot opened while the product is scrubbed fully open
// opens its card with no camera move, and scrubbing back to the assembled
// pose moves no camera either, which leaves the card open at home with the
// product assembled. That path needs the marker shown at the fully
// exploded pose on the layout's stage, by the scrub facts.
//
// The cases run for every routed product. A marker shows only while its keep-out
// box fits the stage, so which markers a view shows depends on the layout's
// stage: the cases come from the facts on each layout's own stage. A case
// is a hotspot whose marker home shows (it is pressed there), open at a
// view that still shows its own marker (the card hangs off it), and every
// layout keeps at least one case, so no layout passes on an empty set.

const { flowsAt, markerViewsAt } = await flowFacts(await shippedProducts())
const extent = await readMarkerExtentTokens()

type OpenView = {
  readonly name: string
  // The authored view the camera rests at with the card open.
  readonly view: AuthoredView
  // Opens the hotspot with the product exploded and then reassembles it:
  // the close-up hotspot open at home.
  readonly openedExploded: boolean
}

// The markers the open view shows: the hotspot's close-up when the case
// rests there, home otherwise.
function shownIn(markerViews: MarkerViews, open: OpenView, hotspotId: string): ReadonlySet<string> {
  const shown = open.name === 'home' ? markerViews.home : markerViews.closeUps.get(hotspotId)
  if (shown === undefined) {
    throw new Error(`no marker view for the close-up of ${hotspotId}`)
  }
  return shown
}

// The views a hotspot can be open at, and how the flow reaches each: a
// plain hotspot opens at home, a close-up hotspot at its close-up, and at
// home when its marker shows at the fully exploded pose, where it is
// opened before the product reassembles.
function openViewsOf(
  flow: HotspotFlow,
  hotspotId: string,
  shownExploded: ReadonlySet<string>,
): readonly OpenView[] {
  const closeUp = flow.subject.viewOf(hotspotId)
  const home = { name: 'home', view: flow.subject.viewFacts.home, openedExploded: false }
  if (closeUp === null) {
    return [home]
  }
  const atCloseUp = { name: 'its close-up', view: closeUp, openedExploded: false }
  return shownExploded.has(hotspotId) ? [atCloseUp, { ...home, openedExploded: true }] : [atCloseUp]
}

// The hotspots whose markers home shows at the fully exploded pose on the
// stage, by one bounded pose of the scrub facts.
async function shownExplodedAt(
  flow: HotspotFlow,
  box: Parameters<typeof readScrubMarkerFacts>[3]['box'],
): Promise<ReadonlySet<string>> {
  const facts = await readScrubMarkerFacts(
    flow.subject.product,
    flow.subject.viewFacts.center,
    flow.subject.viewFacts.home,
    { box, extent },
    [1],
  )
  return new Set([...facts].filter(([, shown]) => shown[0] === true).map(([id]) => id))
}

for (const contract of referenceLayouts) {
  const stage = stageBoxOf(contract)
  const viewsBySlug = markerViewsAt(stage)
  const flows = flowsAt(stage)
  const cases: {
    readonly flow: HotspotFlow
    readonly hotspot: HotspotFlow['subject']['product']['hotspots'][number]
    readonly open: OpenView
  }[] = []
  for (const flow of flows) {
    const product = flow.subject.product
    const markerViews = viewsBySlug.get(product.slug)
    if (markerViews === undefined) {
      throw new Error(`no marker views for ${product.slug}`)
    }
    const shownExploded = await shownExplodedAt(flow, stage)
    const firstCase = cases.length
    for (const hotspot of flow.subject.product.hotspots) {
      if (!markerViews.home.has(hotspot.id)) {
        continue
      }
      for (const open of openViewsOf(flow, hotspot.id, shownExploded)) {
        if (shownIn(markerViews, open, hotspot.id).has(hotspot.id)) {
          cases.push({ flow, hotspot, open })
        }
      }
    }
    if (cases.length === firstCase) {
      throw new Error(
        `no hotspot of ${product.slug} opens on the ${contract.width}x${contract.height} stage at a view that shows its marker`,
      )
    }
  }
  for (const { flow, hotspot, open } of cases) {
    const { product } = flow.subject
    const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
    const titles = product.hotspots.map((entry) => entry.title)
    const where = contract.hotspotCard === 'docks' ? 'docks in the sheet' : 'stays on the stage'
    test(`card placement at ${contract.width}x${contract.height}: ${product.slug} ${hotspot.title} open at ${open.name} leaves every placed marker clear and ${where}`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize({ width: contract.width, height: contract.height })
      await page.goto(productPathOf(backendPath, product))
      await expectProduct(page, product)
      await settledFrames(page)

      // The scrub sets the explode by its value, so no click on panel
      // content can land on a layout the docking card is still shifting.
      const explodeScrub = page.getByRole('slider', { name: explodeLabel })
      if (open.openedExploded) {
        await explodeScrub.fill('1')
        await waitForExplodeRestingAt(page, 1)
      }
      await markerOf(page, hotspot.title).click()
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      if (open.openedExploded) {
        await explodeScrub.fill('0')
        await waitForExplodeRestingAt(page, 0)
      }
      await settledFrames(page)
      if (open.openedExploded) {
        // The scrub is panel content, so using it scrolls the panel to it,
        // as it would for a visitor, who scrolls back to the open card once
        // the stage rests, wherever the card's slot settled. Bring the
        // whole card back: a visible title can leave its header clipped.
        await openCardOf(page).scrollIntoViewIfNeeded()
      }
      await expectAtView(page, flow, open)

      await expect(
        markerOf(page, hotspot.title),
        'the open marker stays selected on the stage',
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      await expectCardWhereTheLayoutPutsIt(
        page,
        contract.hotspotCard,
        hotspot.title,
        titles,
        hotspot.id,
      )
      const placed = await placedMarkerTitles(page, titles)
      expect(placed.length, 'the open view must show at least one marker').toBeGreaterThan(0)
      for (const title of placed) {
        await expectMarkerClearOfCard(page, title, titles)
      }
    })
  }
}

// The camera rests at the authored view the case names, as the app's stage
// aspect resolves it.
async function expectAtView(page: Page, flow: HotspotFlow, open: OpenView): Promise<void> {
  const camera = await readCamera(page)
  if (camera === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }
  const expected = flow.viewAt(open.view, await stageAspectOfCanvas(page))
  expectOrbitAtRest(camera, expected, `the card open at ${open.name}`)
}
