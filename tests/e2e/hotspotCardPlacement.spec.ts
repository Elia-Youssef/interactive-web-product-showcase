import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { waitForProductReady } from './productSpecs'
import { loadCollection } from './productList'
import { settledFrames } from './stageSettle'
import { expectOrbitAtRest, readCamera, stageAspectOfCanvas } from './stageCamera'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { flowFacts, type HotspotFlow } from './hotspotFlowFacts'
import { viewportContracts } from './layoutContracts'
import { expectCardWhereTheLayoutPutsIt } from './hotspotCardOracle'
import type { AuthoredView } from './productCamera'
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
// for every product it can present.

const collection = await loadCollection()
const { flows } = await flowFacts()
const appFlows = flows.filter((flow) => flow.subject.product.slug === collection.first.slug)

type OpenView = {
  readonly name: string
  // The authored view the camera rests at with the card open.
  readonly view: AuthoredView
  // Presses Reset after opening: the close-up hotspot open at home.
  readonly viaReset: boolean
}

function openViewsOf(flow: HotspotFlow, hotspotId: string): readonly OpenView[] {
  const closeUp = flow.subject.viewOf(hotspotId)
  const home = { name: 'home', view: flow.subject.viewFacts.home, viaReset: closeUp !== null }
  return closeUp === null
    ? [home]
    : [{ name: 'its close-up', view: closeUp, viaReset: false }, home]
}

for (const contract of viewportContracts) {
  for (const flow of appFlows) {
    const { product } = flow.subject
    const titles = product.hotspots.map((hotspot) => hotspot.title)
    for (const hotspot of product.hotspots) {
      for (const open of openViewsOf(flow, hotspot.id)) {
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
          for (const title of await placedMarkerTitles(page, titles)) {
            await expectMarkerClearOfCard(page, title, titles)
          }
        })
      }
    }
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
