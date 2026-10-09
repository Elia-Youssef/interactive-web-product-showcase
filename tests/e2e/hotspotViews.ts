import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { expect } from './fixtures'
import { readCamera } from './stageCamera'
import { harnessStageBox } from './lookHarness'
import { projectToStageBox, type Point3 } from './hotspotPlacement'

// The reads and expectations of the hotspot specs: the camera and probe
// reads, the marker and card locators, and the expectations that hold the
// marker DOM against geometry the viewer does not compute. The drag and
// wheel drives that put the camera where an expectation reads it live in
// hotspotDrives.ts, so both halves share one module per job.

// The placement epsilon and where it comes from: both sides project in
// double precision and differ by a few ulps of the stage size, but the
// browser lays the marker out on a 1/64 px grid, so the marker's box center
// is quantized by up to 1/64 px (0.0156) per axis. The bound is a little
// over twice that, plus the float noise, and nothing else.
export const stagePixelEpsilon = 0.05

export function requireCamera(page: Page) {
  return readCamera(page).then((camera) => {
    if (camera === null) {
      throw new Error('the live stage camera must be readable once a view is presented')
    }
    return camera
  })
}

export function requireHotspots(page: Page) {
  return page
    .evaluate(() => window.__viewer?.hotspots ?? null)
    .then((hotspots) => {
      if (hotspots === null) {
        throw new Error('the hotspots probe must be registered while the product is on the stage')
      }
      return hotspots
    })
}

// The center of the harness stage canvas, in page coordinates. The harness
// page has no stage slot; its canvas is the stage's own box.
export async function harnessCanvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await harnessStageBox(page)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// The canvas point the camera drives start from: inside the canvas, in its
// lower left quadrant, where no marker and no open card of the presented
// product sits, because the overlay content hugs the product's projection
// at the center of the view. A drag or a wheel needs the canvas under the
// pointer only at its start; camera-controls tracks the drag on the
// document from there (camera-controls dist/camera-controls.module.js,
// onPointerDown: the move and up listeners attach to the ownerDocument).
export async function harnessCanvasDrivePoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await harnessStageBox(page)
  return { x: box.x + box.width * 0.15, y: box.y + box.height * 0.85 }
}

// The stage aspect the harness page's renderer sees: the canvas box in CSS
// pixels, the box R3F hands the camera as its aspect. The harness page has
// no stage slot; its canvas is the stage's own box.
export async function harnessStageAspect(page: Page): Promise<number> {
  const box = await harnessStageBox(page)
  return box.width / box.height
}

export function markerOf(page: Page, title: string) {
  return page.getByRole('button', { name: title })
}

// State reads cover mounted markers even when projection hides them from
// the role tree. Pointer and focus drives still use the visible markerOf.
export function mountedMarkerOf(page: Page, title: string) {
  return page.getByRole('button', { name: title, includeHidden: true })
}

// The card of the open hotspot: its title heading, the one card the single
// selection renders, floating beside its marker or docked in the layout's
// dock.
export function cardHeadingOf(page: Page, title: string) {
  return page.getByRole('heading', { name: title })
}

// The open card's close button, named by the site copy. One card is open at
// a time, so the label names exactly one button.
export function cardCloseButtonOf(page: Page) {
  return page.getByRole('button', { name: siteCopy.closeLabel })
}

export function titleOf(
  product: { readonly hotspots: readonly { readonly id: string; readonly title: string }[] },
  id: string,
): string {
  const title = product.hotspots.find((hotspot) => hotspot.id === id)?.title
  if (title === undefined) {
    throw new Error(`no manifest hotspot '${id}'`)
  }
  return title
}

// Every listed hotspot's marker against the projection of the anchor the
// probe reports right now, read once for all of them.
export async function expectMarkersAtProjection(
  page: Page,
  hotspots: readonly { readonly id: string; readonly title: string }[],
  why: string,
): Promise<void> {
  const probe = await requireHotspots(page)
  for (const hotspot of hotspots) {
    const anchor = probe.hotspots.find((entry) => entry.id === hotspot.id)
    if (anchor === undefined) {
      throw new Error(`the probe answers no anchor for ${hotspot.id}`)
    }
    await expectMarkerAtProjection(page, hotspot.title, anchor.position, `${hotspot.id} ${why}`)
  }
}

// Every listed hotspot whose marker is shown, against the projection of the
// anchor the probe reports right now, and at least one shown. A view that
// moved can hide a marker by the occlusion rule or the stage edge; which
// markers it hides belongs to the occlusion proof, so a placement proof
// holds the shown ones.
export async function expectShownMarkersAtProjection(
  page: Page,
  hotspots: readonly { readonly id: string; readonly title: string }[],
  why: string,
): Promise<void> {
  const shown: { readonly id: string; readonly title: string }[] = []
  for (const hotspot of hotspots) {
    if (await markerOf(page, hotspot.title).isVisible()) {
      shown.push(hotspot)
    }
  }
  expect(shown.length, `${why}: at least one marker must be shown`).toBeGreaterThan(0)
  await expectMarkersAtProjection(page, shown, why)
}

// The marker's box center against the projection of the anchor the probe
// reports, through this module's own projection.
export async function expectMarkerAtProjection(
  page: Page,
  title: string,
  anchor: Point3,
  why: string,
): Promise<void> {
  const camera = await requireCamera(page)
  const canvas = await harnessStageBox(page)
  const box = await markerOf(page, title).boundingBox()
  if (box === null) {
    throw new Error(`the marker '${title}' must have a bounding box`)
  }
  const projected = projectToStageBox(camera, anchor, canvas)
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  expect(
    Math.abs(centerX - (canvas.x + projected.x)),
    `${why}: marker x ${centerX} against projection ${canvas.x + projected.x}`,
  ).toBeLessThanOrEqual(stagePixelEpsilon)
  expect(
    Math.abs(centerY - (canvas.y + projected.y)),
    `${why}: marker y ${centerY} against projection ${canvas.y + projected.y}`,
  ).toBeLessThanOrEqual(stagePixelEpsilon)
}

// A marker hidden by the visibility rule is invisible, unfocusable and
// unclickable: it takes no focus through script, and the point it would sit
// at hands events to whatever sits under the overlay. The element is
// located with includeHidden, because a hidden element leaves the role tree
// and the check is about exactly that state.
export async function expectHiddenEverywhere(
  page: Page,
  title: string,
  why: string,
): Promise<void> {
  const marker = page.getByRole('button', { name: title, includeHidden: true })
  await expect(marker, `${why}: ${title} must be hidden`).toBeHidden()
  // The verdicts compute inside the page: a DOM element does not survive
  // the evaluate boundary, so the page answers with facts about it.
  const state = await marker.evaluate((element) => {
    element.focus()
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return {
      focused: document.activeElement === element,
      hasTopElement: top !== null,
      topIsButton: top !== null && top.closest('button') !== null,
    }
  })
  expect(state.focused, `${why}: ${title} must not take focus while hidden`).toBe(false)
  expect(
    state.hasTopElement,
    `${why}: the hidden marker's point must still hand events somewhere`,
  ).toBe(true)
  expect(state.topIsButton, `${why}: no button may take the hidden marker's point`).toBe(false)
}
