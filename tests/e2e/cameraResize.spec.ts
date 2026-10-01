import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { waitForProductReady } from './stageCamera'
import { settledFrames, settledStage } from './stageSettle'
import { containedScale, readCamera, REST_THRESHOLD, stageAspectOfCanvas } from './stageCamera'
// The full matrix runs six browsers against one GPU, and the heaviest wait
// in every test here is the busy-matrix ready wait, so each test carries a
// budget above the sum of its waits on the slowest backend.
test.setTimeout(90_000)

// The collection's first product, and its authored camera facts read from
// the shipped `.glb`.
const first = (await loadCollection()).first
const facts = await readProductCameraFacts(first.slug)

test('a resize across the tablet breakpoint keeps the zoom percentage and the azimuth', async ({
  page,
  backendPath,
}) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)

  const desktopAspect = await stageAspectOfCanvas(page)
  const desktop = await readCamera(page)
  if (desktop === null) {
    throw new Error('the live stage camera must be readable')
  }
  // Zoom in a step so the percentage is not the home default the resize
  // could keep by accident.
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await settledFrames(page)
  const moved = await readCamera(page)
  if (moved === null) {
    throw new Error('the live stage camera must be readable')
  }
  const desktopPercent =
    ((moved.maxDistance - moved.distance) / (moved.maxDistance - moved.minDistance)) * 100

  // The tablet breakpoint reflows the layout: the stage box, and with it
  // the aspect the distances scale by, both change.
  await page.setViewportSize({ width: 768, height: 1024 })
  await settledFrames(page)

  const tabletAspect = await stageAspectOfCanvas(page)
  expect(tabletAspect, 'the reflow must change the stage aspect for this proof').not.toBeCloseTo(
    desktopAspect,
    3,
  )
  const tablet = await readCamera(page)
  if (tablet === null) {
    throw new Error('the live stage camera must be readable')
  }

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

  // The limits rescaled by the aspect rule, from the same authored values
  // this spec computes. The aspect in the rule comes from the canvas box,
  // read twice: once by the renderer, once by this spec, whose fractional
  // pixel rounding can differ, hence the precision.
  const desktopScale = containedScale(facts.home.aspect, desktopAspect)
  const tabletScale = containedScale(facts.home.aspect, tabletAspect)
  expect(tablet.minDistance).toBeCloseTo(facts.home.distance * 0.5 * tabletScale, 6)
  expect(tablet.maxDistance).toBeCloseTo(facts.home.distance * 2.5 * tabletScale, 6)
  expect(desktop.minDistance).toBeCloseTo(facts.home.distance * 0.5 * desktopScale, 6)

  // The stage is at rest after the resize.
  expect(await settledFrames(page)).toBeGreaterThan(0)
})
