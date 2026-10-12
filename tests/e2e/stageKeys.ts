import { selectMarkersAtHome } from './markerSelection'
import type { Locator, Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { expect } from './fixtures'
import type { Product } from '../../src/lib/product'
import { markerOf } from './hotspotViews'
import { readCamera, type CameraRead } from './stageCamera'
import { waitForProductReady } from './productSpecs'
import { completedStage } from './stageSettle'

// The reads and drives of the stage key specs: the key target and the
// stage controls by their accessible names, the live camera at rest, the
// shell's live region, and a keydown recorder that tells whether the page
// prevented a key's default. The steps are the camera config's, converted
// with the degree rule restated here, so a viewer regression cannot hide
// behind its own helper.

export const keyTargetOf = (page: Page): Locator =>
  page.getByRole('application', { name: siteCopy.stageLabel })

export const controlOf = (page: Page, name: string): Locator => page.getByRole('button', { name })

export const liveRegionOf = (page: Page): Locator => page.locator('[data-live-announcement]')

export const radiansOf = (degrees: number): number => degrees * (Math.PI / 180)

export const rotateStep = radiansOf(stageCameraConfig.rotateStepDegrees)
export const tiltStep = radiansOf(stageCameraConfig.tiltStepDegrees)
export const fineStep = radiansOf(stageCameraConfig.fineStepDegrees)
export const minPolar = radiansOf(stageCameraConfig.minPolarAngleDegrees)
export const maxPolar = radiansOf(stageCameraConfig.maxPolarAngleDegrees)

// The float bound of an orbit read at rest against the step rule: the
// controls snap the eased angle onto its end at rest, and the end is the
// start plus the step, so only the float sums differ, by ulps of the angle.
export const ORBIT_FLOAT_GAP = 1e-9

export async function readyStage(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForProductReady(page)
  await completedStage(page)
}

// The live camera once the stage is at rest again.
export async function cameraAtRest(page: Page): Promise<CameraRead> {
  await completedStage(page)
  const camera = await readCamera(page)
  if (camera === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }
  return camera
}

// Presses keys on the focused key target, one press each.
export async function pressOnTarget(page: Page, keys: readonly string[]): Promise<void> {
  await keyTargetOf(page).focus()
  for (const key of keys) {
    await page.keyboard.press(key)
  }
}

// The zoom percentage the controls pill shows.
export async function shownZoomPercent(page: Page): Promise<number> {
  const text = await page.locator('[data-corner="bottom-right"]').innerText()
  const match = /(\d+)%/.exec(text)
  if (match === null) {
    throw new Error(`the zoom readout shows no percentage: '${text}'`)
  }
  return Number(match[1])
}

// Records, at the window after every other listener has run, whether the
// page prevented each keydown's default, then prevents it itself so the
// browser's own shortcut (history, page zoom) does not leave the page
// under test. The record is what the app did, read before the recorder's
// own prevent, kept on the document element as one letter per key: p for
// prevented, k for kept. The modifier keys' own keydowns are not recorded:
// the record is about the keys they modify.
export async function recordKeyDefaults(page: Page): Promise<() => Promise<string>> {
  await page.evaluate(() => {
    const root = document.documentElement
    const modifiers = new Set(['Control', 'Alt', 'Meta', 'Shift'])
    root.dataset.keyDefaults = ''
    window.addEventListener('keydown', (event) => {
      if (modifiers.has(event.key)) {
        return
      }
      root.dataset.keyDefaults = `${root.dataset.keyDefaults ?? ''}${event.defaultPrevented ? 'p' : 'k'}`
      event.preventDefault()
    })
  })
  return () => page.evaluate(() => document.documentElement.dataset.keyDefaults ?? '')
}

// The scroll position of the document and every element, for a check that
// keys moved none of them.
export async function scrollPositions(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify([
      [window.scrollX, window.scrollY],
      ...[...document.querySelectorAll('*')].map((element) => [
        element.scrollLeft,
        element.scrollTop,
      ]),
    ]),
  )
}

export async function expectFocusOn(locator: Locator, why: string): Promise<void> {
  expect(await locator.evaluate((element) => element === document.activeElement), why).toBe(true)
}

// A control of the waiting class at its limit: it announces the wait through
// aria-disabled and carries no native disabled attribute, so the browser
// never drops the focus on the body at the moment it waits, and the tab
// order keeps it. The enabled read of a waiting control is its own
// assertion at the calls that need it back.
export async function expectUnavailable(control: Locator): Promise<void> {
  await expect(control).toHaveAttribute('aria-disabled', 'true')
  await expect(control).not.toHaveAttribute('disabled')
}

// The marker of the first hotspot the home view shows: a marker the view
// hides leaves the role tree, so the visible one is a shown one.
export async function shownMarkerOf(page: Page, product: Product): Promise<Locator> {
  const { shown } = await selectMarkersAtHome(page, product)
  for (const hotspot of product.hotspots) {
    const marker = markerOf(page, hotspot.title)
    if (shown.has(hotspot.id)) {
      return marker
    }
  }
  throw new Error(`no marker of '${product.slug}' is shown at the home view`)
}
