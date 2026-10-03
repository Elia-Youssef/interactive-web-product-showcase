import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'
import { markerOf, stagePixelEpsilon } from './hotspotViews'

// The expectations the card specs hold the open hotspot card to, read from
// the page's own layout and hit testing, never from the viewer's placement
// math: where the card hangs against its marker, that it stays inside the
// stage, and that it leaves every placed marker pressable with its focus
// ring in view.

export type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// The open card: one card is open at a time, in whichever slot it shows.
export function openCardOf(page: Page): Locator {
  return page.getByTestId('hotspot-card')
}

// A token length of the document root, in px, read from the tokens
// themselves so no hand-typed number enters an expectation.
export async function tokenPx(page: Page, name: string): Promise<number> {
  const token = await page.evaluate(
    (tokenName) => getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim(),
    name,
  )
  return pxOf(token, name)
}

function pxOf(value: string, what: string): number {
  const parsed = /^(\d*\.?\d+)px$/.exec(value)
  if (parsed === null || parsed[1] === undefined) {
    throw new Error(`${what} is not a px length: '${value}'`)
  }
  return Number(parsed[1])
}

export async function boxOf(locator: Locator, what: string): Promise<Box> {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error(`${what} must have a bounding box`)
  }
  return box
}

// The side of the marker the card hangs on: the card box sits the offset
// off the marker's hit box along one axis and centered on it across, or
// null when it hangs on no side. Both boxes are layout reads, quantized on
// the browser's 1/64 px grid, the bound the placement epsilon carries.
export function cardSideOf(marker: Box, card: Box, offsetPx: number): string | null {
  const near = (a: number, b: number) => Math.abs(a - b) <= stagePixelEpsilon
  const centeredY = near(card.y + card.height / 2, marker.y + marker.height / 2)
  const centeredX = near(card.x + card.width / 2, marker.x + marker.width / 2)
  if (centeredY && near(card.x, marker.x + marker.width + offsetPx)) {
    return 'right'
  }
  if (centeredY && near(card.x + card.width, marker.x - offsetPx)) {
    return 'left'
  }
  if (centeredX && near(card.y, marker.y + marker.height + offsetPx)) {
    return 'below'
  }
  if (centeredX && near(card.y + card.height, marker.y - offsetPx)) {
    return 'above'
  }
  return null
}

// The floating card hangs beside the open marker, the token offset off its
// hit box on one side.
export async function expectCardBesideMarker(page: Page, openTitle: string): Promise<void> {
  const markerBox = await boxOf(markerOf(page, openTitle), `the marker of ${openTitle}`)
  const cardBox = await boxOf(openCardOf(page), 'the open card')
  const offsetPx = await tokenPx(page, '--offset-hotspot-card')
  expect(
    cardSideOf(markerBox, cardBox, offsetPx),
    `the card of ${openTitle} must hang ${offsetPx}px off one side of its marker, centered on it`,
  ).not.toBeNull()
}

// The card box lies inside the stage box, edges included.
export async function expectCardInsideStage(page: Page, stage: Locator): Promise<void> {
  const stageBox = await boxOf(stage, 'the stage')
  const cardBox = await boxOf(openCardOf(page), 'the open card')
  expect(cardBox.x, 'the card must not leave the stage on the left').toBeGreaterThanOrEqual(
    stageBox.x - stagePixelEpsilon,
  )
  expect(cardBox.y, 'the card must not leave the stage at the top').toBeGreaterThanOrEqual(
    stageBox.y - stagePixelEpsilon,
  )
  expect(
    cardBox.x + cardBox.width,
    'the card must not leave the stage on the right',
  ).toBeLessThanOrEqual(stageBox.x + stageBox.width + stagePixelEpsilon)
  expect(
    cardBox.y + cardBox.height,
    'the card must not leave the stage at the bottom',
  ).toBeLessThanOrEqual(stageBox.y + stageBox.height + stagePixelEpsilon)
}

// The titles of the markers the stage shows: placed markers are visible,
// hidden ones are out of the role tree.
export async function placedMarkerTitles(
  page: Page,
  titles: readonly string[],
): Promise<readonly string[]> {
  const placed: string[] = []
  for (const title of titles) {
    if (await markerOf(page, title).isVisible()) {
      placed.push(title)
    }
  }
  return placed
}

// The sampling of a marker's round hit area and its focus ring. The hit
// samples stand on a grid inside the circle, kept off its rim, where hit
// testing a rounded box would weigh the antialiased edge. The ring samples
// stand on the middle of the ring's band, around the whole circle.
const HIT_GRID_STEP_PX = 4
const HIT_RIM_CLEARANCE_PX = 2
const RING_SAMPLES = 32

// Every placed marker stays clear of the open card: its whole hit area
// answers hit testing with the marker, a pointer press would land on it,
// and with keyboard focus its ring is drawn where the card is not.
export async function expectMarkerClearOfCard(
  page: Page,
  title: string,
  markerTitles: readonly string[],
): Promise<void> {
  const marker = markerOf(page, title)
  await expectHitAreaAnswers(marker, title, markerTitles)
  // The pointer's own check: a trial press runs every actionability check
  // a real press runs, the hit target at the press point included, and
  // presses nothing.
  await marker.click({ trial: true })
  await focusVisibly(page, marker)
  await expectRingUncovered(marker, title)
}

// The marker's hit area answers hit testing with the marker. A point the
// hit areas of two markers share answers with whichever marker stacks on
// top; markers that crowd each other are no work of the card, so such a
// point only has to answer with one of the markers, never with the card or
// anything else.
async function expectHitAreaAnswers(
  marker: Locator,
  title: string,
  markerTitles: readonly string[],
): Promise<void> {
  const misses = await marker.evaluate(
    (element, { step, clearance, titles }) => {
      const box = element.getBoundingClientRect()
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      const radius = box.width / 2 - clearance
      const missed: string[] = []
      for (let dx = -radius; dx <= radius; dx += step) {
        for (let dy = -radius; dy <= radius; dy += step) {
          if (dx * dx + dy * dy > radius * radius) {
            continue
          }
          const top = document.elementFromPoint(cx + dx, cy + dy)
          const button = top === null ? null : top.closest('button')
          const answered =
            button === element ||
            (button !== null && titles.includes(button.getAttribute('aria-label') ?? ''))
          if (!answered) {
            missed.push(`(${dx}, ${dy}) ${top === null ? 'nothing' : top.tagName}`)
          }
        }
      }
      return missed
    },
    { step: HIT_GRID_STEP_PX, clearance: HIT_RIM_CLEARANCE_PX, titles: markerTitles },
  )
  expect(misses, `the hit area of ${title} must answer hit testing with ${title}`).toEqual([])
}

// With keyboard focus, the marker's ring is drawn and no sample around the
// middle of its band answers hit testing with the card. The ring follows
// the round hit area, its band from the outline offset out by the outline
// width, read from the focused marker itself.
async function expectRingUncovered(marker: Locator, title: string): Promise<void> {
  const ring = await marker.evaluate((element, samples) => {
    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    const width = Number.parseFloat(style.outlineWidth)
    const offset = Number.parseFloat(style.outlineOffset)
    const radius = box.width / 2 + offset + width / 2
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const covered: number[] = []
    for (let index = 0; index < samples; index += 1) {
      const angle = (2 * Math.PI * index) / samples
      const top = document.elementFromPoint(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
      )
      if (top !== null && top.closest('[data-testid="hotspot-card"]') !== null) {
        covered.push(index)
      }
    }
    return { width, covered }
  }, RING_SAMPLES)
  expect(ring.width, `${title} must draw a focus ring`).toBeGreaterThan(0)
  expect(ring.covered, `the card must cover no part of the focus ring of ${title}`).toEqual([])
}

// Gives the marker keyboard focus with its ring drawn. A script focus draws
// the ring only when the focus it moves from was a keyboard focus, so one
// Tab from the document first makes the focus a keyboard one on every
// engine; the check then holds the ring state itself.
export async function focusVisibly(page: Page, marker: Locator): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      active.blur()
    }
  })
  await page.keyboard.press('Tab')
  const visible = await marker.evaluate((element) => {
    element.focus()
    return element.matches(':focus-visible')
  })
  expect(visible, 'the marker must take keyboard focus with its ring drawn').toBe(true)
}
