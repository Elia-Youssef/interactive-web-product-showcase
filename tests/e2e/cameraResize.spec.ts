import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { waitForProductReady } from './productSpecs'
import { settledFrames, settledStage } from './stageSettle'
import {
  aspectSideViewports,
  type CameraRead,
  homeExpectation,
  readCamera,
  REST_THRESHOLD,
  stageAspectOnSide,
} from './stageCamera'
// The collection's first product, and its authored camera facts read from
// the shipped `.glb`.
const first = (await loadCollection()).first
const facts = await readProductCameraFacts(first.slug)

// Both distance limits of the live camera are the product's resolved
// limits, the same resolution the plan builds from the manifest, scaled by
// the aspect rule at the measured stage aspect. The aspect in the rule comes
// from the canvas box, read twice: once by the renderer, once by this spec,
// whose fractional pixel rounding can differ, hence the precision.
function expectLimitsAtAspect(camera: CameraRead, stageAspect: number): void {
  const expected = homeExpectation(facts, first, stageAspect)
  expect(camera.minDistance).toBeCloseTo(expected.minDistance, 6)
  expect(camera.maxDistance).toBeCloseTo(expected.maxDistance, 6)
}

test('a resize across the tablet breakpoint keeps the zoom percentage and the azimuth', async ({
  page,
  backendPath,
}) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  // The resize crosses the authored aspect: from a stage the rule scales to
  // one it leaves unscaled, so the limits must change by the rule.
  await page.setViewportSize(aspectSideViewports.narrower)
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)

  const desktopAspect = await stageAspectOnSide(page, facts.home.aspect, 'narrower')
  const desktop = await readCamera(page)
  if (desktop === null) {
    throw new Error('the live stage camera must be readable')
  }
  expectLimitsAtAspect(desktop, desktopAspect)
  // Zoom in a step so the percentage is not the home default the resize
  // could keep by accident.
  await page.getByRole('button', { name: siteCopy.zoomInLabel }).click()
  await settledFrames(page)
  const moved = await readCamera(page)
  if (moved === null) {
    throw new Error('the live stage camera must be readable')
  }
  const desktopPercent =
    ((moved.maxDistance - moved.distance) / (moved.maxDistance - moved.minDistance)) * 100

  // The tablet breakpoint reflows the layout: the stage box, and with it
  // the aspect the distances scale by, both change.
  await page.setViewportSize(aspectSideViewports.atLeastAsWide)
  await settledFrames(page)

  const tabletAspect = await stageAspectOnSide(page, facts.home.aspect, 'atLeastAsWide')
  const tablet = await readCamera(page)
  if (tablet === null) {
    throw new Error('the live stage camera must be readable')
  }
  expectLimitsAtAspect(tablet, tabletAspect)

  // The angles are untouched by a resize.
  expect(tablet.azimuth).toBeCloseTo(moved.azimuth, 6)
  expect(tablet.polar).toBeCloseTo(moved.polar, 6)

  // The percentage is the same number at the new aspect, within the rest
  // threshold the live distance carries.
  const tabletPercent =
    ((tablet.maxDistance - tablet.distance) / (tablet.maxDistance - tablet.minDistance)) * 100
  const percentRange = 100 / (tablet.maxDistance - tablet.minDistance)
  expect(
    Math.abs(tabletPercent - desktopPercent),
    'the zoom percentage must survive the resize',
  ).toBeLessThanOrEqual(REST_THRESHOLD * percentRange)

  // The stage is at rest after the resize.
  expect(await settledFrames(page)).toBeGreaterThan(0)
})
