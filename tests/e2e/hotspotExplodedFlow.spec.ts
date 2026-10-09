import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { harnessPath, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { waitForExplodeRestingAt } from './explodeRest'
import {
  cardCloseButtonOf,
  cardHeadingOf,
  harnessCanvasDrivePoint,
  harnessStageAspect,
  markerOf,
  requireCamera,
} from './hotspotViews'
import { flowFacts, type HotspotFlow } from './hotspotFlowFacts'
import { loadCollection } from './productList'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductPath } from '../../src/lib/routing'
import {
  dragOnCanvas,
  expectOrbitAtRest,
  renderedFrames,
  stageAspectOfCanvas,
  type CameraRead,
} from './stageCamera'

// Close-ups apply only to the assembled product, for every close-up of every
// product: opened while the product is exploded, a close-up hotspot opens
// its card and the camera stays where it was; leaving the assembled pose
// from a close-up, by the toggle or by any scrub, returns the camera home
// and keeps the card; the explode returning to the assembled pose moves no
// camera; closing a card opened while exploded moves no camera; Reset
// closes the card and returns home. Every camera check reads the controls'
// end state where the contract is equality: a camera nothing moved reads
// the same, and a return home lands its target on the home view's exactly
// (setLookAt copies it, camera-controls dist/camera-controls.module.js);
// the orbit angles of a move at rest sit within the controls' rest
// threshold of the view (expectOrbitAtRest, which cites it).

const { flows } = await flowFacts()

// The Reset case drives the product page's own chrome, which only a routed
// product presents: the fixture products run the spec's harness cases and
// the routed ones run this case too.
const routedSlugs = new Set((await loadCollection()).products.map((product) => product.slug))

for (const flow of flows) {
  const { product } = flow.subject
  const slug = product.slug
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

  for (const closeUp of flow.subject.closeUps) {
    test(`hotspots ${slug}: opening ${closeUp.title} while exploded opens its card and leaves the camera where it was`, async ({
      page,
      backendPath,
    }) => {
      await presentHarness(page, backendPath, slug)
      await page.getByRole('button', { name: explodeLabel }).click()
      await waitForExplodeRestingAt(page, 1)
      const framesBefore = await settledFrames(page)
      const cameraBefore = await requireCamera(page)

      await markerOf(page, closeUp.title).click()
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()

      expect(await requireCamera(page)).toEqual(cameraBefore)
      expect(await renderedFrames(page), 'the open must render no frame').toBe(framesBefore)
    })

    for (const [way, leave] of leaveWays(explodeLabel)) {
      test(`hotspots ${slug}: ${way} from the ${closeUp.title} close-up returns home and keeps its card`, async ({
        page,
        backendPath,
      }) => {
        await presentHarness(page, backendPath, slug)
        await markerOf(page, closeUp.title).click()
        await settledFrames(page)
        expect((await requireCamera(page)).target).toEqual(
          flow.viewAt(closeUp.view, await harnessStageAspect(page)).target,
        )

        const target = await leave(page)
        await waitForExplodeRestingAt(page, target)
        await settledFrames(page)

        await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()
        await expectHome(flow, await requireCamera(page), await harnessStageAspect(page))
      })
    }

    test(`hotspots ${slug}: returning the explode to the assembled pose after leaving the ${closeUp.title} close-up moves no camera`, async ({
      page,
      backendPath,
    }) => {
      await presentHarness(page, backendPath, slug)
      await markerOf(page, closeUp.title).click()
      await settledFrames(page)
      const toggle = page.getByRole('button', { name: explodeLabel })
      await toggle.click()
      await waitForExplodeRestingAt(page, 1)
      await settledFrames(page)
      const cameraAtHome = await requireCamera(page)

      await toggle.click()
      await waitForExplodeRestingAt(page, 0)
      await settledFrames(page)

      expect(await requireCamera(page)).toEqual(cameraAtHome)
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()
    })

    test(`hotspots ${slug}: closing ${closeUp.title} opened while exploded moves no camera`, async ({
      page,
      backendPath,
    }) => {
      await presentHarness(page, backendPath, slug)
      await page.getByRole('button', { name: explodeLabel }).click()
      await waitForExplodeRestingAt(page, 1)
      await markerOf(page, closeUp.title).click()
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()

      // An orbit off the home view first, so a return home would show.
      const drivePoint = await harnessCanvasDrivePoint(page)
      await dragOnCanvas(page, drivePoint, { x: drivePoint.x + 40, y: drivePoint.y - 20 })
      const framesBefore = await settledFrames(page)
      const cameraBefore = await requireCamera(page)

      await cardCloseButtonOf(page).click()
      await expect(cardHeadingOf(page, closeUp.title)).toBeHidden()

      expect(await requireCamera(page)).toEqual(cameraBefore)
      expect(await renderedFrames(page), 'the close must render no frame').toBe(framesBefore)
    })

    test(`hotspots ${slug}: Reset closes the ${closeUp.title} card and returns home`, async ({
      page,
      backendPath,
    }) => {
      test.skip(
        !routedSlugs.has(slug),
        'Reset is the product page chrome: it runs on routed products',
      )
      // The stage controls that carry Reset are the product page's chrome.
      await page.goto(formatProductPath(slug) + new URL(backendPath, 'https://app.invalid').search)
      await waitForProductReady(page)
      await settledFrames(page)
      await markerOf(page, closeUp.title).click()
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()
      await settledFrames(page)

      await page.getByRole('button', { name: siteCopy.resetLabel }).click()
      await settledFrames(page)

      await expect(cardHeadingOf(page, closeUp.title)).toBeHidden()
      await expect(markerOf(page, closeUp.title)).toHaveAttribute('aria-pressed', 'false')
      await expectHome(flow, await requireCamera(page), await stageAspectOfCanvas(page))
    })
  }
}

async function presentHarness(page: Page, backendPath: string, slug: string): Promise<void> {
  await page.goto(harnessPath(backendPath, slug))
  await waitForProductReady(page)
  await settledFrames(page)
}

// The ways to leave the assembled pose, each answering the explode target
// it set: the toggle opens fully, a scrub opens fully, a scrub opens part
// of the way.
function leaveWays(
  explodeLabel: string,
): readonly (readonly [string, (page: Page) => Promise<number>])[] {
  const scrubTo = (target: number) => async (page: Page) => {
    await page.getByRole('slider', { name: explodeLabel }).fill(String(target))
    return target
  }
  return [
    [
      'exploding with the toggle',
      async (page) => {
        await page.getByRole('button', { name: explodeLabel }).click()
        return 1
      },
    ],
    ['scrubbing the explode fully open', scrubTo(1)],
    ['scrubbing the explode part of the way open', scrubTo(0.3)],
  ]
}

// The camera back on the home view: the target exactly, the orbit within
// the controls' rest threshold.
async function expectHome(flow: HotspotFlow, camera: CameraRead, stageAspect: number) {
  const home = flow.homeAt(stageAspect)
  expect(camera.target).toEqual(home.target)
  expectOrbitAtRest(camera, home, 'the camera returns home')
}
