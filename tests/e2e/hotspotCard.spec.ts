import { expect, test } from './fixtures'
import { expectPoll, harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { dragOnCanvas } from './stageCamera'
import { completedPresentation } from './presentationCompletion'
import {
  cardCloseButtonOf,
  cardHeadingOf,
  expectHiddenEverywhere,
  expectMarkersAtProjection,
  harnessCanvasDrivePoint,
  harnessStageAspect,
  markerOf,
  requireCamera,
  requireHotspots,
} from './hotspotViews'
import { expectCardBesideMarker } from './hotspotCardChecks'
import { driveToHidingView, oppositeAzimuthOf, zoomToDistanceBand } from './hotspotDrives'
import { occlusionCandidates, requireFollowSubjects } from './occlusionSubjects'
import { runtimeOcclusionSubjects } from './runtimeOcclusionSubjects'
import { flowFacts } from './hotspotFlowFacts'

// The card of the open hotspot: it is placed beside its marker in every
// overlay pass the markers are placed in, so it follows the marker's
// placement, hides whenever the marker hides, and renders no frame of its
// own; reduced motion lands the close-up on the next rendered
// frame; leaving the product clears the card. The follow test must keep the
// camera at home, so it runs for a plain hotspot; the remount and rest
// checks move no camera, so they run for a hotspot of any kind; reduced
// motion needs a close-up. Every test runs for each product that has what
// it drives. The camera flow (open, switch, close) lives in
// hotspotFlow.spec.ts, over the same facts module.

const { flows, factsBySlug } = await flowFacts(await harnessProducts())

const products = flows.map((flow) => flow.subject.product)
const occlusionSubjects = runtimeOcclusionSubjects(products, factsBySlug)
const candidates = occlusionCandidates(products, factsBySlug)
test.beforeAll(() => {
  requireFollowSubjects(
    flows.map((flow) => ({
      slug: flow.subject.product.slug,
      hasPlainHotspot: flow.subject.plains.length > 0,
    })),
    occlusionSubjects(),
  )
})

for (const flow of flows) {
  const { product, viewFacts } = flow.subject
  const slug = product.slug
  const closeUp = flow.subject.closeUps[0]
  const plain = flow.subject.plains[0]
  const anyHotspot = product.hotspots[0]

  if (plain !== undefined && candidates.has(slug)) {
    test(`hotspots ${slug}: the open card of ${plain.title} follows its marker and hides with the marker of an occludable hotspot behind the body`, async ({
      page,
      backendPath,
    }) => {
      // One load, one drag, the wheel zoom from the close-up distance to the
      // hiding band (a hundred small wheel steps at the measured dolly rate)
      // and one hiding drive.
      const occludable = occlusionSubjects().get(slug)
      if (occludable === undefined) {
        test.skip(true, 'the product has no occludable hotspot with a hiding height')
        return
      }
      test.setTimeout(testBudgetMs({ productLoads: 1, cameraDrives: 3 }))
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await completedPresentation(page)

      // With the plain card open at home, a drag moves the marker, and the
      // card follows it: at rest the marker sits on its projection, and the
      // card hangs beside it.
      await markerOf(page, plain.title).click()
      await expect(cardHeadingOf(page, plain.title)).toBeVisible()
      // The drag starts at the canvas point the overlay content does not
      // cover: the open card hugs the marker at the center of the view.
      const drivePoint = await harnessCanvasDrivePoint(page)
      await dragOnCanvas(page, drivePoint, { x: drivePoint.x + 240, y: drivePoint.y })
      const framesAfterDrag = await completedPresentation(page)
      await expectMarkersAtProjection(page, [plain], 'with the card open, after a drag')

      // The card hangs beside the marker it belongs to, the token offset off
      // the marker's hit box, on whichever side the placement found room:
      // after the drag the right side would cover the other marker.
      await expectCardBesideMarker(page, plain.title)

      // The stage stays put: the open card asked for no frame of its own.
      expect(
        await completedPresentation(page),
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
      await completedPresentation(page)

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
      await completedPresentation(page)
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
      await completedPresentation(page)

      await markerOf(page, anyHotspot.title).click()
      await expect(cardHeadingOf(page, anyHotspot.title)).toBeVisible()
      const frames = await completedPresentation(page)

      expect(
        await completedPresentation(page),
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
      await completedPresentation(page)

      const expected = flow.viewAt(closeUp.view, await harnessStageAspect(page))
      const framesBefore = await completedPresentation(page)
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
      const framesAtCloseUp = await completedPresentation(page)
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
