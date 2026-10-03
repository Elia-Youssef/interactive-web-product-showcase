import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { waitForProductReady } from './productSpecs'
import { loadCollection } from './productList'
import { settledFrames } from './stageSettle'
import { expectOrbitAtRest, readCamera, stageAspectOfCanvas } from './stageCamera'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { flowFacts, type HotspotFlow } from './hotspotFlowFacts'
import { stageBoxOf, viewportContracts } from './layoutContracts'
import { expectCardWhereTheLayoutPutsIt } from './hotspotCardOracle'
import type { AuthoredView } from './productCamera'
import type { MarkerViews } from './productMarkerViews'
import { expectMarkerClearOfCard, placedMarkerTitles } from './hotspotCardChecks'

// The open card never gets in the way, on the app page at every layout
// size: for every hotspot, in every authored view it can be open in (home,
// and its close-up when it has one), every placed marker stays clear of the
// card (its hit area answers hit testing with the marker, a pointer press
// lands on it, its focus ring is drawn where the card is not) and the open
// marker stays selected. Where the layout floats cards, a floating card
// hangs beside its marker inside the stage; where it docks them (the
// phone's sheet), the card is in the panel. A close-up hotspot is open at
// home after Reset, which returns the camera home and keeps the card open.
//
// The app page presents the collection's first product, so the cases run
// for every product it can present. A marker shows only while its keep-out
// box fits the stage, so which markers a view shows depends on the layout's
// stage: the cases come from the facts on each layout's own stage. A case
// is a hotspot whose marker home shows (it is pressed there), open at a
// view that still shows its own marker (the card hangs off it), and every
// layout keeps at least one case, so no layout passes on an empty set.

const collection = await loadCollection()
const { flowsAt, markerViewsAt } = await flowFacts()

type OpenView = {
  readonly name: string
  // The authored view the camera rests at with the card open.
  readonly view: AuthoredView
  // Presses Reset after opening: the close-up hotspot open at home.
  readonly viaReset: boolean
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

function openViewsOf(flow: HotspotFlow, hotspotId: string): readonly OpenView[] {
  const closeUp = flow.subject.viewOf(hotspotId)
  const home = { name: 'home', view: flow.subject.viewFacts.home, viaReset: closeUp !== null }
  return closeUp === null
    ? [home]
    : [{ name: 'its close-up', view: closeUp, viaReset: false }, home]
}

for (const contract of viewportContracts) {
  const stage = stageBoxOf(contract)
  const markerViews = markerViewsAt(stage).get(collection.first.slug)
  if (markerViews === undefined) {
    throw new Error(`no marker views for ${collection.first.slug}`)
  }
  const cases = flowsAt(stage)
    .filter((flow) => flow.subject.product.slug === collection.first.slug)
    .flatMap((flow) =>
      flow.subject.product.hotspots
        .filter((hotspot) => markerViews.home.has(hotspot.id))
        .flatMap((hotspot) =>
          openViewsOf(flow, hotspot.id)
            .filter((open) => shownIn(markerViews, open, hotspot.id).has(hotspot.id))
            .map((open) => ({ flow, hotspot, open })),
        ),
    )
  if (cases.length === 0) {
    throw new Error(
      `no hotspot of ${collection.first.slug} opens on the ${contract.width}x${contract.height} stage at a view that shows its marker`,
    )
  }
  for (const { flow, hotspot, open } of cases) {
    const { product } = flow.subject
    const titles = product.hotspots.map((entry) => entry.title)
    const where = contract.hotspotCard === 'docks' ? 'docks in the sheet' : 'stays on the stage'
    test(`card placement at ${contract.width}x${contract.height}: ${product.slug} ${hotspot.title} open at ${open.name} leaves every placed marker clear and ${where}`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize({ width: contract.width, height: contract.height })
      await page.goto(backendPath)
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, hotspot.title).click()
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      if (open.viaReset) {
        await settledFrames(page)
        await page.getByRole('button', { name: siteCopy.resetLabel }).click()
      }
      await settledFrames(page)
      await expectAtView(page, flow, open)

      await expect(
        markerOf(page, hotspot.title),
        'the open marker stays selected on the stage',
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      await expectCardWhereTheLayoutPutsIt(page, contract.hotspotCard, hotspot.title, titles)
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
