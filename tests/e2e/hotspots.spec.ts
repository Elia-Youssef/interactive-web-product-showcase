import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { expectPoll, harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { readProductHotspotFacts } from './productHotspots'
import type { ProductHotspotFacts } from './productHotspots'
import { isInsideBox, segmentEntersBox } from './hotspotPlacement'
import { settledFrames } from './stageSettle'
import {
  dragToAzimuth,
  dragToPolarAtMost,
  driveToHidingView,
  expectHiddenEverywhere,
  expectMarkerAtProjection,
  expectMarkersAtProjection,
  factsBoundsOf,
  markerOf,
  occludableFact,
  oppositeAzimuthOf,
  requireCamera,
  requireHotspots,
  titleOf,
} from './hotspotViews'

// The placement half of the hotspot specs: where the markers stand at rest,
// that the body hides the marker it stands in front of, and that a mount on
// a resting stage still gets its placements. The markers following each
// input of their projection live in hotspotRepositioning.spec.ts, the
// interaction halves in hotspotInteraction.spec.ts.

const products = await harnessProducts()
const factsBySlug = new Map<string, ProductHotspotFacts>()
for (const product of products) {
  factsBySlug.set(product.slug, await readProductHotspotFacts(product.slug, product))
}

for (const product of products) {
  const facts = factsBySlug.get(product.slug)
  if (facts === undefined) {
    throw new Error(`no hotspot facts for ${product.slug}`)
  }
  const slug = product.slug

  test(`hotspots ${slug}: each manifest hotspot shows one marker at its anchor's projection`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const probe = await requireHotspots(page)
    expect(probe.product, 'the probe answers this product').toBe(slug)
    expect(
      probe.hotspots.map((hotspot) => hotspot.id),
      'the probe answers one anchor per manifest hotspot, in manifest order',
    ).toEqual(product.hotspots.map((hotspot) => hotspot.id))

    for (const hotspot of product.hotspots) {
      await expect(markerOf(page, hotspot.title)).toHaveCount(1)
    }
    await expectMarkersAtProjection(page, product.hotspots, 'at rest')
  })

  test(`hotspots ${slug}: the body hides the marker it stands in front of, and home shows it again`, async ({
    page,
    backendPath,
  }) => {
    // One load and four camera drives: to the hiding view (azimuth, then
    // polar) and back home (azimuth, then polar).
    test.setTimeout(testBudgetMs({ productLoads: 1, cameraDrives: 4 }))
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    // The view is found by geometry, against the shipped meshes themselves.
    // The occluded anchor is the one inside the occluding meshes' bounds,
    // and its hiding height is a fact the facts module computes by
    // raycasting those meshes in Node: a camera height from which the
    // anchor's opposite-azimuth ray is blocked by a mesh before the anchor
    // while every other anchor's ray is clear, across the orbit's distance
    // range and the drive's azimuth tolerance. The runtime rule needs no
    // epsilon, and neither does the search: a hit at the anchor's own
    // distance does not block it, which is why the marker still shows at
    // home, where its ray reaches the anchor through the model's open front.
    const occluded = occludableFact(facts)
    const occludedTitle = titleOf(product, occluded.id)
    const otherIds = facts.hotspots.filter((fact) => fact.id !== occluded.id).map((fact) => fact.id)
    const bounds = factsBoundsOf(facts)
    const hidingHeightM = occluded.hidingHeightM
    if (hidingHeightM === null) {
      throw new Error(`the facts found no hiding height for ${occluded.id}`)
    }

    const cameraAtHome = await requireCamera(page)
    const probeAtHome = await requireHotspots(page)
    const anchorAtHome = probeAtHome.hotspots.find((entry) => entry.id === occluded.id)
    if (anchorAtHome === undefined) {
      throw new Error(`the probe answers no anchor for ${occluded.id}`)
    }
    const homeAzimuth = cameraAtHome.azimuth
    const homePolar = cameraAtHome.polar
    const hidingPolar = Math.acos((hidingHeightM - cameraAtHome.target.y) / cameraAtHome.distance)

    await driveToHidingView(
      page,
      oppositeAzimuthOf(cameraAtHome, anchorAtHome.position),
      hidingPolar,
    )

    // The argument's preconditions hold for the reached view: the anchor
    // inside the occluder bounds, the camera outside them, and the segment
    // entering the bounds strictly before the anchor.
    const camera = await requireCamera(page)
    const probe = await requireHotspots(page)
    const anchor = probe.hotspots.find((entry) => entry.id === occluded.id)
    if (anchor === undefined) {
      throw new Error(`the probe answers no anchor for ${occluded.id}`)
    }
    expect(
      isInsideBox(anchor.position, bounds),
      'the occluded anchor must lie inside the occluder bounds',
    ).toBe(true)
    expect(
      isInsideBox(camera.position, bounds),
      'the camera must stand outside the occluder bounds',
    ).toBe(false)
    expect(
      segmentEntersBox(camera.position, anchor.position, bounds),
      'the view ray must enter the occluder bounds before the anchor',
    ).not.toBeNull()

    await expectHiddenEverywhere(page, occludedTitle, 'behind the body')
    for (const otherId of otherIds) {
      const otherTitle = titleOf(product, otherId)
      await expect(markerOf(page, otherTitle), `${otherTitle} must still show`).toBeVisible()
    }

    // Back at home, at the home view's own height, the ray to the anchor
    // reaches it past the meshes again: the body no longer stands between,
    // and the marker shows again at the projection it had before.
    await dragToAzimuth(page, homeAzimuth)
    await dragToPolarAtMost(page, homePolar)
    await settledFrames(page)
    await expect(
      markerOf(page, occludedTitle),
      `${occludedTitle} must show again at home`,
    ).toBeVisible()
    await expectMarkerAtProjection(
      page,
      occludedTitle,
      anchorAtHome.position,
      `${occluded.id} back home`,
    )
  })

  test(`hotspots ${slug}: a product mounted on a resting stage still gets its markers placed`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    // Unmount at rest, then mount again: the stage stands still around the
    // mount, and the markers must show once the product is ready, placed at
    // the projection.
    await page.getByTestId('remount-product').click()
    await expectPoll(page, () => window.__viewer?.product ?? null).toBe('idle')
    await settledFrames(page)
    for (const hotspot of product.hotspots) {
      await expect(markerOf(page, hotspot.title)).toHaveCount(0)
    }

    await page.getByTestId('remount-product').click()
    await waitForProductReady(page)
    await settledFrames(page)
    for (const hotspot of product.hotspots) {
      await expect(markerOf(page, hotspot.title), `${hotspot.title} must show`).toBeVisible()
    }
    await expectMarkersAtProjection(page, product.hotspots, 'mounted at rest')
  })
}
