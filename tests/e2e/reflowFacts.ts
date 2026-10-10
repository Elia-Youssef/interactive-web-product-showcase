import type { Locator, Page } from '@playwright/test'

// The reflow facts of a page as the visitor sees it at one viewport, read
// from the live DOM: what spills past its box, what the layout shell clips,
// which stage chrome slots collide, and where the panel's content sits.
// Nothing here names today's content: every element the top bar, the panel
// and the chrome hold is read, whatever they hold.

export type Rect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// One element of a read: a short description and its border box.
export type Placed = { readonly name: string; readonly box: Rect }

export type ReflowFacts = {
  readonly viewport: { readonly width: number; readonly height: number }
  readonly documentScrollWidth: number
  // The layout shell's own scroll extents against its box: a shell that
  // clips its overflow hides whatever passes its box.
  readonly layout: ScrollExtent
  // Every element of the top bar and the panel whose content spills past
  // its own box sideways.
  readonly spills: readonly string[]
  // Every element of the top bar that leaves the top bar's box.
  readonly topBarEscapes: readonly string[]
  readonly stage: Rect
  // The stage chrome slots that show, and whether their content fits them.
  readonly corners: readonly (Placed & { readonly contentFits: boolean })[]
  readonly panel: Rect & ScrollExtent & { readonly scrollTop: number }
  // The panel content's rows in document order.
  readonly panelRows: readonly Placed[]
  // The resting sheet's content: the product's eyebrow, its title, the
  // finish heading and the swatch group.
  readonly resting: readonly Placed[]
}

type ScrollExtent = {
  readonly scrollWidth: number
  readonly clientWidth: number
  readonly scrollHeight: number
  readonly clientHeight: number
}

// The shown elements a locator matches, with their boxes, in document order.
function placedOf(locator: Locator): Promise<Placed[]> {
  return locator.evaluateAll((elements) =>
    elements
      .filter((element) => getComputedStyle(element).display !== 'none')
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const box = element.getBoundingClientRect()
        const text = (element.textContent ?? '').trim().slice(0, 40)
        return {
          name: `${element.tagName.toLowerCase()} "${text}"`,
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        }
      }),
  )
}

// The shown block elements a locator matches whose content is wider than
// their box: a block's scroll width passes its client width. Inline boxes
// report no client width and are measured through the block that holds them.
export function spillsOf(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .filter((element) => getComputedStyle(element).display !== 'none')
      .filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth)
      .map((element) => {
        const text = (element.textContent ?? '').trim().slice(0, 40)
        return `${element.tagName.toLowerCase()} "${text}" ${element.scrollWidth} > ${element.clientWidth}`
      }),
  )
}

function scrollExtentOf(locator: Locator) {
  return locator.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollTop: element.scrollTop,
  }))
}

async function boxOf(locator: Locator, name: string): Promise<Placed> {
  const [placed] = await placedOf(locator)
  if (placed === undefined) {
    throw new Error(`the page shows no ${name}`)
  }
  return { name, box: placed.box }
}

export async function readReflowFacts(
  page: Page,
  labels: { readonly panel: string; readonly stage: string },
): Promise<ReflowFacts> {
  const header = page.getByRole('banner')
  const panel = page.getByRole('complementary', { name: labels.panel })
  const stage = page.getByRole('region', { name: labels.stage })
  const finishGroup = panel.getByRole('radiogroup')
  const bar = (await boxOf(header, 'top bar')).box
  const topBarContent = await placedOf(header.locator('*'))
  const corners = await stage.locator('[data-corner]').evaluateAll((slots) =>
    slots
      .filter((slot) => getComputedStyle(slot).display !== 'none')
      .map((slot) => {
        const box = slot.getBoundingClientRect()
        return {
          name: slot.getAttribute('data-corner') ?? 'an unnamed corner',
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
          contentFits:
            slot.scrollWidth <= slot.clientWidth && slot.scrollHeight <= slot.clientHeight,
        }
      }),
  )
  return {
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
    documentScrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    layout: await scrollExtentOf(page.locator('header').locator('xpath=..')),
    spills: await spillsOf(page.locator('header, header *, aside, aside *')),
    topBarEscapes: topBarContent.filter((item) => !inside(item.box, bar)).map((item) => item.name),
    stage: (await boxOf(stage, 'stage')).box,
    corners,
    panel: { ...(await boxOf(panel, 'panel')).box, ...(await scrollExtentOf(panel)) },
    panelRows: await placedOf(panel.locator('[data-slot="panel"] > * > *')),
    resting: [
      await boxOf(panel.locator('p:has(> [data-eyebrow-tail])'), 'the product eyebrow'),
      await boxOf(panel.getByRole('heading', { level: 1 }), 'the title'),
      await boxOf(finishGroup.locator('xpath=..').locator('h2'), 'the finish heading'),
      await boxOf(finishGroup, 'the swatch group'),
    ],
  }
}

// Whether two boxes share any area.
export function overlaps(one: Rect, other: Rect): boolean {
  return (
    one.left < other.right &&
    other.left < one.right &&
    one.top < other.bottom &&
    other.top < one.bottom
  )
}

// Whether a box lies inside another.
export function inside(box: Rect, frame: Rect): boolean {
  return (
    box.left >= frame.left &&
    box.right <= frame.right &&
    box.top >= frame.top &&
    box.bottom <= frame.bottom
  )
}
