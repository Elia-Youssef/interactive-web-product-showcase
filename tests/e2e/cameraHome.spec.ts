import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { waitForProductReady } from './productSpecs'
import { settledStage } from './stageSettle'
import {
  ASPECT_SIDES,
  type AspectSide,
  aspectSideViewports,
  describeAspectSide,
  homeExpectation,
  readCamera,
  stageAspectOnSide,
} from './stageCamera'
import { angleReadoutText, zoomReadoutText } from '../../src/lib/copy/stageReadouts'
import { normalizedAzimuthDegrees } from '../../src/lib/camera/azimuth'
// The collection's first product, as the app builds it from the manifests.
const first = (await loadCollection()).first

// The authored facts of that product, read once per spec from the shipped
// `.glb`, without the viewer's own math.
const facts = await readProductCameraFacts(first.slug)

// The home view at one side of the authored camera aspect: the stage is
// ready and settled, and its measured aspect sits on that side, so the
// expectation runs the aspect rule's scale for that side.
async function homeStageAspect(page: Page, backendPath: string, side: AspectSide): Promise<number> {
  await page.setViewportSize(aspectSideViewports[side])
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)
  return stageAspectOnSide(page, facts.home.aspect, side)
}

// Every home check runs on both sides: on the narrower one every distance
// of the view is scaled, on the other it is not.
for (const side of ASPECT_SIDES) {
  test(`the stage camera starts at the home view the model authors, ${describeAspectSide(side)}`, async ({
    page,
    backendPath,
  }) => {
    const stageAspect = await homeStageAspect(page, backendPath, side)
    const expected = homeExpectation(facts, first, stageAspect)
    const camera = await readCamera(page)
    if (camera === null) {
      throw new Error('the automation must carry the live stage camera once a view is presented')
    }

    // The lens is the authored one: Blender owns camera views.
    expect(camera.fovY).toBeCloseTo(expected.fovY, 12)

    // The orbit target is the authored one, computed in this spec from the
    // `.glb`. The viewer and this spec decompose the authored camera through
    // two quaternion paths, which agree to float rounding.
    expect(camera.target.x).toBeCloseTo(expected.target.x, 7)
    expect(camera.target.y).toBeCloseTo(expected.target.y, 7)
    expect(camera.target.z).toBeCloseTo(expected.target.z, 7)

    // The live position sits within the controls' rest threshold of the
    // authored home position (see stageCamera.ts for the threshold's source).
    expect(camera.position.x).toBeCloseTo(expected.position.x, 2)
    expect(camera.position.y).toBeCloseTo(expected.position.y, 2)
    expect(camera.position.z).toBeCloseTo(expected.position.z, 2)

    // The distance limits are the product's resolved limits, the manifest's
    // authored sides and the config ratios of the authored home distance
    // for the rest, scaled by the aspect rule. The aspect in the rule is the
    // canvas box, read once by the renderer and once by this spec, whose
    // fractional pixel rounding can differ, hence the precision.
    expect(camera.minDistance).toBeCloseTo(expected.minDistance, 6)
    expect(camera.maxDistance).toBeCloseTo(expected.maxDistance, 6)
    const percent =
      ((camera.maxDistance - camera.distance) / (camera.maxDistance - camera.minDistance)) * 100
    expect(percent, 'the home view sits at the home percentage of the resolved limits').toBeCloseTo(
      expected.zoomPercent,
      6,
    )
  })

  test(`the chrome readouts read the live camera at home, ${describeAspectSide(side)}`, async ({
    page,
    backendPath,
  }) => {
    const stageAspect = await homeStageAspect(page, backendPath, side)
    const expected = homeExpectation(facts, first, stageAspect)

    // The angle readout is the home azimuth the expectation's own position
    // and target derive, normalized into [0, 360) and formatted the way the
    // chrome formats it.
    const azimuthRadians = Math.atan2(
      expected.position.x - expected.target.x,
      expected.position.z - expected.target.z,
    )
    const angle = page.locator('[data-corner="top-right"]')
    await expect(angle).toHaveText(angleReadoutText(normalizedAzimuthDegrees(azimuthRadians)))

    // The zoom readout is the exact linear map of the live distance between
    // the limits, formatted as the chrome formats it: at home, the resolved
    // limits put the product at the home percentage.
    const zoom = page.locator('[data-corner="bottom-right"]')
    await expect(zoom).toContainText(zoomReadoutText(expected.zoomPercent))
  })
}
