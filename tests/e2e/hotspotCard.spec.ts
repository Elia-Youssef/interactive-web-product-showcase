import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { expectPoll, harnessPath, waitForProductReady } from './productSpecs'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { dragOnCanvas } from './stageCamera'
import { settledFrames } from './stageSettle'
import {
  cardCloseButtonOf,
  cardHeadingOf,
  expectHiddenEverywhere,
  expectMarkersAtProjection,
  harnessCanvasDrivePoint,
  harnessStageAspect,
  markerOf,
  occludableFact,
  requireCamera,
  requireHotspots,
  stagePixelEpsilon,
} from './hotspotViews'
import { driveToHidingView, oppositeAzimuthOf, zoomToDistanceBand } from './hotspotDrives'
import type { ProductHotspotFacts } from './productHotspots'
import { flowFacts } from './hotspotFlowFacts'

// The card of the open hotspot: it rides its marker's anchor, so it follows
// the marker's placement, hides whenever the marker hides, and renders no
// frame of its own; reduced motion lands the close-up on the next rendered
// frame; leaving the product clears the card. The follow test must keep the
// camera at home, so it runs for a plain hotspot; the remount and rest
// checks move no camera, so they run for a hotspot of any kind; reduced
// motion needs a close-up. Every test runs for each product that has what
// it drives. The camera flow (open, switch, close) lives in
// hotspotFlow.spec.ts, over the same facts module.

const { flows, factsBySlug } = await flowFacts()

for (const flow of flows) {
  const { product, viewFacts } = flow.subject
  const slug = product.slug
  const closeUp = flow.subject.closeUps[0]
  const plain = flow.subject.plains[0]
  const anyHotspot = product.hotspots[0]
  // The follow test's hiding half opens the occludable hotspot's card, so
  // the subject is resolved at collection, where the test's title names it.
  const occludable =
    plain === undefined ? undefined : occludableSubjectOf(product, factsBySlug.get(slug))

  if (plain !== undefined && occludable !== undefined) {
    test(`hotspots ${slug}: the open card of ${plain.title} follows its marker and hides with the marker of ${occludable.hotspot.title} behind the body`, async ({
      page,
      backendPath,
    }) => {
      // One load, one drag, the wheel zoom from the close-up distance to the
      // hiding band (a hundred small wheel steps at the measured dolly rate)
      // and one hiding drive.
      test.setTimeout(testBudgetMs({ productLoads: 1, cameraDrives: 3 }))
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      // With the plain card open at home, a drag moves the marker, and the
      // card rides inside its anchor: at rest the anchor sits on the marker's
      // projection, and the card hangs beside the marker it is anchored to.
      await markerOf(page, plain.title).click()
      await expect(cardHeadingOf(page, plain.title)).toBeVisible()
      // The drag starts at the canvas point the overlay content does not
      // cover: the open card hugs the marker at the center of the view.
      const drivePoint = await harnessCanvasDrivePoint(page)
      await dragOnCanvas(page, drivePoint, { x: drivePoint.x + 240, y: drivePoint.y })
      const framesAfterDrag = await settledFrames(page)
      await expectMarkersAtProjection(page, [plain], 'with the card open, after a drag')

      // The card's own box hangs the token offset to the right of the
      // marker's, vertically centered on it. Both reads quantize on the
      // browser's 1/64 px layout grid, the bound the placement epsilon
      // carries, and the offset value is the token itself.
      const markerBox = await markerOf(page, plain.title).boundingBox()
      const cardBox = await page.getByTestId('hotspot-card').boundingBox()
      if (markerBox === null || cardBox === null) {
        throw new Error('the marker and the open card must have bounding boxes')
      }
      const offsetPx = await offsetHotspotCardPx(page)
      expect(
        Math.abs(cardBox.x - (markerBox.x + markerBox.width) - offsetPx),
        `the card must hang the ${offsetPx}px token offset to the right of the marker`,
      ).toBeLessThanOrEqual(stagePixelEpsilon)
      expect(
        Math.abs(cardBox.y + cardBox.height / 2 - (markerBox.y + markerBox.height / 2)),
        'the card must be vertically centered on the marker',
      ).toBeLessThanOrEqual(stagePixelEpsilon)

      // The stage stays put: the open card asked for no frame of its own.
      expect(
        await settledFrames(page),
        'the settled stage must render no frame for the open card',
      ).toBe(framesAfterDrag)

      // The card is hidden whenever its marker is. The occludable hotspot's
      // card opens (its close-up, if it has one, eases the camera there
      // first), the wheel brings the orbit distance into the band the hiding
      // height holds across, and the drive reaches the hiding view. At that
      // view the marker is hidden and the card with it, with nothing closing
      // the card on the way.
      await markerOf(page, occludable.hotspot.title).click()
      await expect(cardHeadingOf(page, occludable.hotspot.title)).toBeVisible()
      const homeDistance = viewFacts.home.distance
      await zoomToDistanceBand(page, {
        min: 0.95 * homeDistance,
        max: 1.2 * homeDistance,
      })
      const camera = await requireCamera(page)
      const probe = await requireHotspots(page)
      const anchor = probe.hotspots.find((entry) => entry.id === occludable.hotspot.id)
      if (anchor === undefined) {
        throw new Error(`the probe answers no anchor for ${occludable.hotspot.id}`)
      }
      const hidingPolar = Math.acos((occludable.hidingHeightM - camera.target.y) / camera.distance)
      await driveToHidingView(page, oppositeAzimuthOf(camera, anchor.position), hidingPolar)

      await expectHiddenEverywhere(
        page,
        occludable.hotspot.title,
        'behind the body with its card open',
      )
      await expect(
        page.getByTestId('hotspot-card'),
        'the card must hide with its marker',
      ).toBeHidden()
      await expect(cardCloseButtonOf(page)).toBeHidden()
    })
  }

  if (anyHotspot !== undefined) {
    test(`hotspots ${slug}: remounting the product clears the open card of ${anyHotspot.title} and the pressed state`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, anyHotspot.title).click()
      await expect(cardHeadingOf(page, anyHotspot.title)).toBeVisible()

      await page.getByTestId('remount-product').click()
      await expectPoll(page, () => window.__viewer?.product ?? null, productLoadBudgetMs).toBe(
        'idle',
      )
      await expect(
        cardHeadingOf(page, anyHotspot.title),
        'the card must be gone while the product is away',
      ).toHaveCount(0)

      await page.getByTestId('remount-product').click()
      await waitForProductReady(page)
      await settledFrames(page)
      for (const hotspot of product.hotspots) {
        await expect(
          markerOf(page, hotspot.title),
          `${hotspot.title} must remount unpressed`,
        ).toHaveAttribute('aria-pressed', 'false')
      }
      await expect(cardHeadingOf(page, anyHotspot.title)).toHaveCount(0)
    })

    test(`hotspots ${slug}: an open card of ${anyHotspot.title} renders no frame on a stage at rest`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, anyHotspot.title).click()
      await expect(cardHeadingOf(page, anyHotspot.title)).toBeVisible()
      const frames = await settledFrames(page)

      expect(
        await settledFrames(page),
        'the stage must render no frame while a card is open at rest',
      ).toBe(frames)
    })
  }

  if (closeUp !== undefined) {
    test(`hotspots ${slug}: under reduced motion the close-up of ${closeUp.title} and the return home land on the next rendered frame`, async ({
      page,
      backendPath,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      const expected = flow.viewAt(closeUp.view, await harnessStageAspect(page))
      const framesBefore = await settledFrames(page)
      await markerOf(page, closeUp.title).click()
      await page.waitForFunction(
        (previous: number) => (window.__viewer?.renderedFrames ?? -1) > previous,
        framesBefore,
        { polling: 'raf' },
      )

      // The first rendered frame after the press already shows the close-up:
      // reduced motion moves the camera instantly, with no eased approach.
      const landed = await requireCamera(page)
      expect(landed.azimuth).toBeCloseTo(expected.azimuth, 6)
      expect(landed.polar).toBeCloseTo(expected.polar, 6)
      expect(landed.distance).toBeCloseTo(expected.distance, 6)

      // Pressing the active marker again closes and returns home, the same
      // instant way.
      const framesAtCloseUp = await settledFrames(page)
      await markerOf(page, closeUp.title).click()
      await page.waitForFunction(
        (previous: number) => (window.__viewer?.renderedFrames ?? -1) > previous,
        framesAtCloseUp,
        { polling: 'raf' },
      )
      const home = flow.homeAt(await harnessStageAspect(page))
      const backHome = await requireCamera(page)
      expect(backHome.azimuth).toBeCloseTo(home.azimuth, 6)
      expect(backHome.polar).toBeCloseTo(home.polar, 6)
      expect(backHome.distance).toBeCloseTo(home.distance, 6)
    })
  }
}

// The occludable hotspot as the hiding half of the follow test drives it:
// the manifest hotspot whose anchor lies inside the body bounds, with the
// camera height the facts found for hiding it. Both resolve at collection,
// where the test's title names the hotspot; a product that owes this proof
// but offers no occludable anchor or no hiding height fails here instead of
// dropping it.
type OccludableSubject = {
  readonly hotspot: Product['hotspots'][number]
  readonly hidingHeightM: number
}

function occludableSubjectOf(
  product: Product,
  facts: ProductHotspotFacts | undefined,
): OccludableSubject {
  if (facts === undefined) {
    throw new Error(`no hotspot facts for ${product.slug}`)
  }
  const fact = occludableFact(facts)
  const hotspot = product.hotspots.find((entry) => entry.id === fact.id)
  if (hotspot === undefined) {
    throw new Error(`no manifest hotspot '${fact.id}'`)
  }
  if (fact.hidingHeightM === null) {
    throw new Error(`the facts found no hiding height for ${fact.id}`)
  }
  return { hotspot, hidingHeightM: fact.hidingHeightM }
}

// A token length of the document root, in px, read from the tokens
// themselves so no hand-typed number enters an expectation.
async function tokenPx(page: Page, name: string): Promise<number> {
  const token = await page.evaluate(
    (tokenName) => getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim(),
    name,
  )
  const parsed = /^(\d*\.?\d+)px$/.exec(token)
  if (parsed === null || parsed[1] === undefined) {
    throw new Error(`${name} is not a px length: '${token}'`)
  }
  return Number(parsed[1])
}

async function offsetHotspotCardPx(page: Page): Promise<number> {
  return tokenPx(page, '--offset-hotspot-card')
}
