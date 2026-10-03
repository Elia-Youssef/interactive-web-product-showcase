import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { siteCopy } from '../../src/lib/copy/site'
import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { projectToStageBox, type Point3 } from './hotspotPlacement'
import { stagePixelEpsilon } from './hotspotViews'
import { expectPoll, harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import type { CameraRead } from './stageCamera'
import { settledFrames } from './stageSettle'

// The hotspots and the exploded view together. The explode writes the part
// poses in a content frame step, before the present, and the marker pass
// runs in the post-present phase of the same frame, so every presented
// frame of an explode carries markers placed on the pose that frame drew.
// A frame's steps, its present and its post-present phase run in one task
// of the page, so a read taken in any other task sees one presented
// frame's state whole, mid-motion as well as at rest. Each read holds the
// live anchors to the anchors as the last presented frame drew them (no
// pose written after the present), and every shown marker to the
// projection of its drawn anchor. The reads run through the whole motion
// while the explode opens and while a scrub to the middle moves it, and
// once more at rest after each, with no frame rendered for the markers
// after rest. A marker a part covers is hidden by the occlusion rule;
// which markers that is belongs to the occlusion proof, so this proof
// holds every shown marker and requires at least one.

const products = await harnessProducts()

for (const product of products) {
  const slug = product.slug
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

  test(`hotspots ${slug}: while the explode opens and while a scrub moves it, and at rest after each, every shown marker sits on its projection`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    await page.getByRole('button', { name: explodeLabel }).click()
    expectReadsOnProjection(
      product,
      await readsThroughMotion(page, product),
      'while the explode opens',
    )
    await expectExplodeRestingAt(page, 1)
    await expectShownMarkersOnLastFrame(page, product, 'with the explode open')

    await page.getByRole('slider', { name: explodeLabel }).fill('0.5')
    expectReadsOnProjection(
      product,
      await readsThroughMotion(page, product),
      'while the scrub moves the explode',
    )
    await expectExplodeRestingAt(page, 0.5)
    await expectShownMarkersOnLastFrame(page, product, 'after a scrub to the middle')
  })
}

// One read of the stage in one page task: the explode's applied progress,
// the live camera, the stage canvas box, every hotspot anchor's live
// position, and every manifest marker's box and visibility.
type StageSample = {
  readonly t: number
  readonly moving: boolean
  readonly camera: CameraRead
  readonly canvas: { readonly x: number; readonly y: number; width: number; height: number }
  // The anchors live, as the scene holds them now, and as the last
  // presented frame drew them.
  readonly anchors: readonly { readonly id: string; readonly position: Point3 }[]
  readonly drawnAnchors: readonly { readonly id: string; readonly position: Point3 }[]
  readonly markers: readonly {
    readonly title: string
    readonly shown: boolean
    readonly centerX: number
    readonly centerY: number
  }[]
}

function readStageSample(page: Page, titles: readonly string[]): Promise<StageSample | null> {
  return page.evaluate((markerTitles) => {
    const viewer = window.__viewer
    const explode = viewer?.explode ?? null
    const camera = viewer?.camera ?? null
    const hotspots = viewer?.hotspots ?? null
    const drawnAnchors = window.__harnessPresentedAnchors?.() ?? null
    const canvas = document.querySelector('main canvas')
    if (
      explode === null ||
      camera === null ||
      hotspots === null ||
      drawnAnchors === null ||
      canvas === null
    ) {
      return null
    }
    const canvasBox = canvas.getBoundingClientRect()
    const markers = []
    for (const title of markerTitles) {
      const matches = [...document.querySelectorAll('button')].filter(
        (button) => button.getAttribute('aria-label') === title,
      )
      const marker = matches[0]
      if (matches.length !== 1 || marker === undefined) {
        return null
      }
      const box = marker.getBoundingClientRect()
      markers.push({
        title,
        shown: getComputedStyle(marker).visibility === 'visible',
        centerX: box.x + box.width / 2,
        centerY: box.y + box.height / 2,
      })
    }
    return {
      t: explode.t,
      moving: explode.moving,
      camera,
      canvas: { x: canvasBox.x, y: canvasBox.y, width: canvasBox.width, height: canvasBox.height },
      anchors: hotspots.hotspots,
      drawnAnchors: [...drawnAnchors],
      markers,
    }
  }, titles)
}

// Reads in back to back page tasks from the request until the explode
// reports rest, each one a whole presented frame's state: the reads of the
// motion. A page task falls between two frames, so the reads land between
// the motion's frames, wherever its anchors move.
async function readsThroughMotion(page: Page, product: Product): Promise<readonly StageSample[]> {
  const titles = product.hotspots.map((hotspot) => hotspot.title)
  const reads: StageSample[] = []
  for (;;) {
    const sample = await readStageSample(page, titles)
    if (sample === null) {
      throw new Error('the stage must answer a full read while the explode moves')
    }
    if (!sample.moving) {
      return reads
    }
    reads.push(sample)
  }
}

// Every read of a motion against what the canvas shows. The reads must
// cover the anchors moving, an anchor standing elsewhere from one read to
// the next, or a read could hold trivially while nothing moved.
function expectReadsOnProjection(
  product: Product,
  reads: readonly StageSample[],
  why: string,
): void {
  const moved = reads.some((read, index) => {
    const previous = reads[index - 1]
    return previous !== undefined && !sameAnchors(previous.drawnAnchors, read.drawnAnchors)
  })
  expect(moved, `${why}: the reads must cover the anchors moving (${reads.length} reads)`).toBe(
    true,
  )
  for (const read of reads) {
    expectShownMarkersOnProjection(product, read, why)
  }
}

function sameAnchors(a: StageSample['drawnAnchors'], b: StageSample['drawnAnchors']): boolean {
  return a.every((anchor, index) => {
    const other = b[index]
    return (
      other !== undefined &&
      other.id === anchor.id &&
      other.position.x === anchor.position.x &&
      other.position.y === anchor.position.y &&
      other.position.z === anchor.position.z
    )
  })
}

// The read against what the canvas shows: every anchor stands where the
// last presented frame drew it, exactly, since both are the same world
// position computed from the same node state, so no pose was written after
// that frame's present; and every shown marker sits on the projection of
// its drawn anchor, by the suite's own projection and its placement epsilon.
function expectShownMarkersOnProjection(product: Product, sample: StageSample, why: string): void {
  expect(
    sample.anchors,
    `${why} at t ${sample.t}: the live anchors must be the drawn ones`,
  ).toEqual(sample.drawnAnchors)
  const shown = sample.markers.filter((marker) => marker.shown)
  expect(shown.length, `${why}: at least one marker must be shown`).toBeGreaterThan(0)
  for (const marker of shown) {
    const hotspot = product.hotspots.find((entry) => entry.title === marker.title)
    const anchor = sample.drawnAnchors.find((entry) => entry.id === hotspot?.id)
    if (anchor === undefined) {
      throw new Error(`${why}: the probe answers no anchor for the marker '${marker.title}'`)
    }
    const projected = projectToStageBox(sample.camera, anchor.position, sample.canvas)
    const at = `${why} at t ${sample.t}: ${marker.title}`
    expect(
      Math.abs(marker.centerX - (sample.canvas.x + projected.x)),
      `${at} marker x ${marker.centerX} against projection ${sample.canvas.x + projected.x}`,
    ).toBeLessThanOrEqual(stagePixelEpsilon)
    expect(
      Math.abs(marker.centerY - (sample.canvas.y + projected.y)),
      `${at} marker y ${marker.centerY} against projection ${sample.canvas.y + projected.y}`,
    ).toBeLessThanOrEqual(stagePixelEpsilon)
  }
}

// The explode at rest on the target: the spring has stopped, and the
// applied progress lands exactly on the target it was asked for.
async function expectExplodeRestingAt(page: Page, target: number): Promise<void> {
  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(target)
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(target)
}

// Every shown marker on the projection of the pose the motion ended on, and
// no frame rendered after rest: the stage settles first, so the markers
// read are the ones the motion's last presented frame placed.
async function expectShownMarkersOnLastFrame(
  page: Page,
  product: Product,
  why: string,
): Promise<void> {
  const framesAtRest = await settledFrames(page)
  const sample = await readStageSample(
    page,
    product.hotspots.map((hotspot) => hotspot.title),
  )
  if (sample === null) {
    throw new Error(`${why}: the stage must answer a full read at rest`)
  }
  expectShownMarkersOnProjection(product, sample, why)
  expect(
    await settledFrames(page),
    `${why}: the settled stage must render no frame for the markers`,
  ).toBe(framesAtRest)
}
