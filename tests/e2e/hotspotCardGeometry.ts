import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { requireCamera, requireHotspots, markerOf } from './hotspotViews'
import { focusVisibly } from './measurementFocus'
import { harnessStageBox } from './lookHarness'
import { projectToStageBox } from './hotspotPlacement'
import { boxOf, openCardOf, tokenPx, type Box } from './hotspotCardChecks'

// The page geometry the card placement rule is restated over: the stage,
// the open marker, every visible marker's keep-out box, the open hotspot's
// projected subject extent, the stage chrome corners, the card's floating
// size, and the side boxes and their excesses against it all. Every box is
// a layout or projection read in page coordinates, never a value the
// viewer's placement code computed.

export const SIDES = ['right', 'left', 'below', 'above'] as const

export type Side = (typeof SIDES)[number]

export type Geometry = {
  readonly stage: Box
  readonly marker: Box
  readonly offsetPx: number
  readonly keepOuts: readonly Box[]
  readonly subject: Box | null
  readonly chrome: readonly Box[]
  readonly card: { readonly width: number; readonly height: number }
}

// The page geometry the rule is restated over, in page coordinates. The
// ring reach is read from a marker drawing its ring; the card's floating
// size is the card itself when it floats, or a measure of its copy laid out
// in the overlay box at the floating width rule when it is docked. The
// subject extent is the open hotspot's part projected through this module's
// own camera math, in page coordinates like every other box.
export async function geometryOf(
  page: Page,
  openTitle: string,
  markerTitles: readonly string[],
  openHotspotId: string,
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
    subject: await subjectBoxOf(page, openHotspotId),
    chrome: await chromeBoxesOf(page),
    card: docked
      ? await floatingSizeOfDocked(page, openTitle)
      : await boxOf(openCardOf(page), 'the open card'),
  }
}

// The projected extent of the open hotspot's subject, from the world box the
// anchor probe reports, through this module's own projection, as a page box.
async function subjectBoxOf(page: Page, openHotspotId: string): Promise<Box | null> {
  const probe = await requireHotspots(page)
  const hotspot = probe.hotspots.find((entry) => entry.id === openHotspotId)
  if (hotspot === undefined) {
    throw new Error(`the probe answers no anchor for ${openHotspotId}`)
  }
  const camera = await requireCamera(page)
  const canvas = await harnessStageBox(page)
  const size = { width: canvas.width, height: canvas.height }
  const subject = hotspot.subject
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (let corner = 0; corner < 8; corner += 1) {
    const point = {
      x: (corner & 1) === 0 ? subject.min.x : subject.max.x,
      y: (corner & 2) === 0 ? subject.min.y : subject.max.y,
      z: (corner & 4) === 0 ? subject.min.z : subject.max.z,
    }
    const projected = projectToStageBox(camera, point, size)
    left = Math.min(left, projected.x)
    right = Math.max(right, projected.x)
    top = Math.min(top, projected.y)
    bottom = Math.max(bottom, projected.y)
  }
  return {
    x: canvas.x + left,
    y: canvas.y + top,
    width: right - left,
    height: bottom - top,
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
export function sideBoxOf(side: Side, { marker, offsetPx, card }: Geometry): Box {
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
// into a keep-out box, its own subject or a corner. Zero or below means the
// side has room; a box that only touches an obstacle breaks nothing.
export function excessOf(box: Box, geometry: Geometry): number {
  const { stage } = geometry
  const past = [
    stage.x - box.x,
    stage.y - box.y,
    box.x + box.width - (stage.x + stage.width),
    box.y + box.height - (stage.y + stage.height),
  ]
  const into = [
    ...geometry.keepOuts,
    ...(geometry.subject === null ? [] : [geometry.subject]),
    ...geometry.chrome,
  ].map((obstacle) => overlapDepth(box, obstacle))
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
