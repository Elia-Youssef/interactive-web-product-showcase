import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { expect } from './fixtures'
import { focusVisibly } from './measurementFocus'
import { markerOf, stagePixelEpsilon } from './hotspotViews'
import {
  boxOf,
  cardSideOf,
  expectCardInsideStage,
  openCardOf,
  tokenPx,
  type Box,
} from './hotspotCardChecks'

// Where the open card must be, restated from the page's own geometry, never
// from the viewer's placement code: the stage box, the open marker's box,
// the offset token, every visible marker's box grown by the reach of the
// focus ring it really draws, the stage chrome corners, and the card's
// floating size. On a layout that docks every card, the card is in the
// panel. On a floating layout the card hangs on the first side, in the
// order right, left, below, above, whose box clears the stage edge, every
// keep-out box and every corner; it docks only when no side clears. Either
// way the docked card is in the visitor's view and its close button answers
// a press. The comparisons carry the placement epsilon: every box is a
// layout read on the browser's 1/64 px grid.

const SIDES = ['right', 'left', 'below', 'above'] as const

type Side = (typeof SIDES)[number]

type Geometry = {
  readonly stage: Box
  readonly marker: Box
  readonly offsetPx: number
  readonly keepOuts: readonly Box[]
  readonly chrome: readonly Box[]
  readonly card: { readonly width: number; readonly height: number }
}

export async function expectCardWhereTheLayoutPutsIt(
  page: Page,
  layout: 'floats' | 'docks',
  openTitle: string,
  markerTitles: readonly string[],
): Promise<void> {
  const stage = page.getByRole('region', { name: siteCopy.stageLabel })
  const inPanel = page
    .getByRole('complementary', { name: siteCopy.panelLabel })
    .getByTestId('hotspot-card')
  if (layout === 'docks') {
    await expectDockedInView(page)
    return
  }
  const geometry = await geometryOf(page, openTitle, markerTitles, (await inPanel.count()) > 0)
  const excess = SIDES.map((side) => excessOf(sideBox(side, geometry), geometry))
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
    `the ${side ?? 'chosen'} side must clear every obstacle`,
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
  await expect(docked, 'the docked card is in view in the panel').toBeInViewport()
  await expect(docked.getByRole('heading'), 'the docked title is in view').toBeInViewport()
  await expect(
    docked.getByRole('button', { name: siteCopy.closeLabel }),
    'the docked close button is in view',
  ).toBeInViewport()
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

// The page geometry the rule is restated over, in page coordinates. The
// ring reach is read from a marker drawing its ring; the card's floating
// size is the card itself when it floats, or a measure of its copy laid out
// in the overlay box at the floating width rule when it is docked.
async function geometryOf(
  page: Page,
  openTitle: string,
  markerTitles: readonly string[],
  docked: boolean,
): Promise<Geometry> {
  const marker = markerOf(page, openTitle)
  await focusVisibly(page, marker)
  const ringReach = await marker.evaluate((element) => {
    const style = getComputedStyle(element)
    return Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth)
  })
  const keepOuts: Box[] = []
  for (const title of markerTitles) {
    const other = markerOf(page, title)
    if (await other.isVisible()) {
      const box = await boxOf(other, `the marker of ${title}`)
      keepOuts.push({
        x: box.x - ringReach,
        y: box.y - ringReach,
        width: box.width + 2 * ringReach,
        height: box.height + 2 * ringReach,
      })
    }
  }
  return {
    stage: await boxOf(page.getByRole('region', { name: siteCopy.stageLabel }), 'the stage'),
    marker: await boxOf(marker, `the marker of ${openTitle}`),
    offsetPx: await tokenPx(page, '--offset-hotspot-card'),
    keepOuts,
    chrome: await chromeBoxesOf(page),
    card: docked
      ? await floatingSizeOfDocked(page, openTitle)
      : await boxOf(openCardOf(page), 'the open card'),
  }
}

async function chromeBoxesOf(page: Page): Promise<readonly Box[]> {
  return page.getByRole('region', { name: siteCopy.stageLabel }).evaluate((stage) =>
    [...stage.querySelectorAll('[data-corner]')]
      .map((corner) => corner.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => ({ x: box.x, y: box.y, width: box.width, height: box.height })),
  )
}

// The docked card's copy, laid out in the overlay box (the open marker's
// anchor's parent) at the floating width rule: its content's width up to
// the card width token.
async function floatingSizeOfDocked(
  page: Page,
  openTitle: string,
): Promise<{ readonly width: number; readonly height: number }> {
  const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
  const copy = await panel.getByTestId('hotspot-card').evaluate((docked) => docked.innerHTML)
  return markerOf(page, openTitle).evaluate((element, html) => {
    const overlayBox = element.parentElement?.parentElement
    if (overlayBox === null || overlayBox === undefined) {
      throw new Error('the marker must sit in an anchor inside the overlay box')
    }
    const probe = document.createElement('div')
    probe.style.position = 'absolute'
    probe.style.insetBlockStart = '0'
    probe.style.insetInlineStart = '0'
    probe.style.inlineSize = 'max-content'
    probe.style.maxInlineSize = 'var(--size-hotspot-card-max)'
    probe.style.visibility = 'hidden'
    probe.innerHTML = html
    overlayBox.appendChild(probe)
    const box = probe.getBoundingClientRect()
    probe.remove()
    return { width: box.width, height: box.height }
  }, copy)
}

// The card box on one side: the offset off the marker's box along the
// side's axis, centered on the marker across it.
function sideBox(side: Side, { marker, offsetPx, card }: Geometry): Box {
  const cx = marker.x + marker.width / 2
  const cy = marker.y + marker.height / 2
  const size = { width: card.width, height: card.height }
  switch (side) {
    case 'right':
      return { x: marker.x + marker.width + offsetPx, y: cy - card.height / 2, ...size }
    case 'left':
      return { x: marker.x - offsetPx - card.width, y: cy - card.height / 2, ...size }
    case 'below':
      return { x: cx - card.width / 2, y: marker.y + marker.height + offsetPx, ...size }
    case 'above':
      return { x: cx - card.width / 2, y: marker.y - offsetPx - card.height, ...size }
  }
}

// How far the box breaks the rule: its largest step past a stage edge or
// into a keep-out box or a corner. Zero or below means the side has room;
// a box that only touches an obstacle breaks nothing.
function excessOf(box: Box, geometry: Geometry): number {
  const { stage } = geometry
  const past = [
    stage.x - box.x,
    stage.y - box.y,
    box.x + box.width - (stage.x + stage.width),
    box.y + box.height - (stage.y + stage.height),
  ]
  const into = [...geometry.keepOuts, ...geometry.chrome].map((obstacle) =>
    overlapDepth(box, obstacle),
  )
  return Math.max(...past, ...into)
}

function overlapDepth(a: Box, b: Box): number {
  return Math.min(
    a.x + a.width - b.x,
    b.x + b.width - a.x,
    a.y + a.height - b.y,
    b.y + b.height - a.y,
  )
}
