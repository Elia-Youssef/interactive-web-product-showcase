import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { expect } from './fixtures'
import { stagePixelEpsilon } from './hotspotViews'
import { mountedMarkerOf } from './hotspotViews'
import { expectCardPartsInsideBand } from './cardBand'
import { completedPresentation, revealCompleted } from './presentationCompletion'
import { boxOf, cardSideOf, expectCardInsideStage, openCardOf } from './hotspotCardChecks'
import { excessOf, geometryOf, SIDES, sideBoxOf, type Geometry } from './hotspotCardGeometry'

// Where the open card must be, restated from the page's own geometry, never
// from the viewer's placement code: the stage box, the open marker's box,
// the offset token, every visible marker's box grown by the reach of the
// focus ring it really draws, the stage chrome corners, the projected
// extent of the open hotspot's subject (from the anchor probe and this
// module's own projection), and the card's floating size. On a layout that
// docks every card, the card is in the panel. On a floating layout the card
// hangs on the first side, in the order right, left, below, above, whose
// box clears the stage edge, every keep-out box, every corner and its own
// subject; it docks only when no side clears. Either way the docked card is
// in the visitor's view and its close button answers a press. The
// comparisons carry the placement epsilon: every box is a layout read on
// the browser's 1/64 px grid.

export async function expectCardWhereTheLayoutPutsIt(
  page: Page,
  layout: 'floats' | 'docks',
  openTitle: string,
  markerTitles: readonly string[],
  openHotspotId: string,
): Promise<void> {
  await completedPresentation(page)
  const inPanel = page
    .getByRole('complementary', { name: siteCopy.panelLabel })
    .getByTestId('hotspot-card')
  if (layout === 'docks') {
    await expectDockedInView(page)
    return
  }
  if (await expectUnplacedMarkerCard(page, openTitle, openHotspotId)) return
  await revealCompleted(page, page.locator('canvas'))
  if (await expectUnplacedMarkerCard(page, openTitle, openHotspotId)) return
  const geometry = await geometryOf(
    page,
    openTitle,
    markerTitles,
    openHotspotId,
    (await inPanel.count()) > 0,
  )
  const excess = SIDES.map((side) => excessOf(sideBoxOf(side, geometry), geometry))
  if ((await inPanel.count()) > 0) {
    SIDES.forEach((side, index) => {
      expect(
        excess[index],
        `the card docked, so the ${side} side must have no room, yet it clears by ${-(excess[index] ?? 0)}px`,
      ).toBeGreaterThanOrEqual(-stagePixelEpsilon)
    })
    await expectDockedInView(page)
    return
  }
  await expectFloatingCardOnChosenSide(page, openTitle, geometry, excess)
}

// Marker loss keeps a panel card readable and hides a floating card.
// Geometry has no anchor to measure in either unplaced-marker case.
async function expectUnplacedMarkerCard(
  page: Page,
  title: string,
  hotspotId: string,
): Promise<boolean> {
  if (await mountedMarkerOf(page, title).isVisible()) return false
  const stage = page.getByRole('region', { name: siteCopy.stageLabel })
  const floating = stage.getByTestId('hotspot-card')
  if ((await floating.count()) === 0) {
    await expectDockedInView(page)
  } else {
    await expect(floating).toHaveCount(1)
    await expect(floating, 'only a floating card hides with its marker').toBeHidden()
    expect(await page.evaluate(() => window.__viewer?.overlay?.card)).toMatchObject({
      selected: hotspotId,
      slot: 'floating',
      mounted: true,
      shown: false,
    })
  }
  return true
}

// The floating card hangs on the first side whose box clears everything:
// the side it took must be clear, and every side before it must have had no
// room.
async function expectFloatingCardOnChosenSide(
  page: Page,
  openTitle: string,
  geometry: Geometry,
  excess: readonly number[],
): Promise<void> {
  const stage = page.getByRole('region', { name: siteCopy.stageLabel })
  await expect(stage.getByTestId('hotspot-card'), 'the floating card is on the stage').toBeVisible()
  await expectCardInsideStage(page, stage)
  const side = cardSideOf(
    geometry.marker,
    await boxOf(openCardOf(page), 'the open card'),
    geometry.offsetPx,
  )
  const chosen = SIDES.findIndex((candidate) => candidate === side)
  expect(
    chosen,
    `the card of ${openTitle} must hang off one side of its marker`,
  ).toBeGreaterThanOrEqual(0)
  expect(
    excess[chosen],
    `the ${side ?? 'chosen'} side must clear every obstacle, its subject included`,
  ).toBeLessThanOrEqual(stagePixelEpsilon)
  for (let index = 0; index < chosen; index += 1) {
    expect(
      excess[index],
      `the card took ${side ?? 'a later side'}, so the earlier ${SIDES[index] ?? ''} side must have no room`,
    ).toBeGreaterThanOrEqual(-stagePixelEpsilon)
  }
  await expectCloseAnswers(page)
}

// The docked card is in the panel, in the visitor's view (inside the
// panel's scrollport and the viewport), with its title and close button in
// view, no card on the stage, and its close button answering a press.
export async function expectDockedInView(page: Page): Promise<void> {
  const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
  const docked = panel.getByTestId('hotspot-card')
  await revealCompleted(page, docked.getByRole('button', { name: siteCopy.closeLabel }))
  await expectCardPartsInsideBand([
    docked.getByRole('heading'),
    docked.getByRole('button', { name: siteCopy.closeLabel }),
  ])
  await expect(
    page.getByRole('region', { name: siteCopy.stageLabel }).getByTestId('hotspot-card'),
    'a docked card leaves the stage',
  ).toHaveCount(0)
  await expectCloseAnswers(page)
}

// The open card's close button answers hit testing at its center: nothing,
// the stage chrome included, paints over it.
export async function expectCloseAnswers(page: Page): Promise<void> {
  const close = openCardOf(page).getByRole('button', { name: siteCopy.closeLabel })
  const answers = await close.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return top !== null && top.closest('button') === element
  })
  expect(answers, 'the card close button must answer a press at its center').toBe(true)
}
