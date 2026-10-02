import { expect, test } from './fixtures'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { dragOnCanvas } from './stageCamera'
import { expectMarkersAtProjection, harnessCanvasCenter } from './hotspotViews'

// The repositioning half of the hotspot specs: a marker's placement follows
// every input of its projection, each changed on its own. The camera moves
// by a drag and by a zoom step, the stage changes size, and a part moves
// from its own frame callback. After each change comes to rest, every
// marker sits on the new projection with no frame rendered after rest: the
// placement ran on the change's last presented frame. The placement at
// rest, the occlusion and the mount live in hotspots.spec.ts.

const products = await harnessProducts()

for (const product of products) {
  const slug = product.slug

  test(`hotspots ${slug}: after a drag and a zoom step the markers sit on the new projection, with no frame rendered after rest`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const center = await harnessCanvasCenter(page)
    await dragOnCanvas(page, center, { x: center.x + 240, y: center.y })
    const framesAfterDrag = await settledFrames(page)
    await expectMarkersAtProjection(page, product.hotspots, 'after a drag')
    // The stage stays put across a whole settle window: the markers asked
    // for no frame of their own.
    expect(
      await settledFrames(page),
      'the settled stage must render no frame for the markers',
    ).toBe(framesAfterDrag)

    // The zoom steps wheel out, not in: wheeling in from home can reach a
    // view where the product genuinely occludes an anchor (measured on the
    // placeholder speaker: the steps clamp at the authored minimum distance
    // and the body hides the knob anchor there), and which markers survive
    // that view is the occlusion contract's proof, not this one. Moving
    // away can only clear an occlusion, so every marker's expectation stays
    // well defined for any product.
    await page.mouse.move(center.x, center.y)
    for (let step = 0; step < 3; step += 1) {
      await page.mouse.wheel(0, 240)
    }
    const framesAfterZoom = await settledFrames(page)
    await expectMarkersAtProjection(page, product.hotspots, 'after a zoom step')
    expect(
      await settledFrames(page),
      'the settled stage must render no frame for the markers after the zoom',
    ).toBe(framesAfterZoom)
  })

  test(`hotspots ${slug}: a stage resize places the markers on the new projection`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    // The harness stage fills the viewport, so a narrower viewport is a
    // narrower stage: the projection's stage size and the camera's aspect
    // both change, with no camera move and no node move.
    const viewport = page.viewportSize()
    if (viewport === null) {
      throw new Error('the resize proof needs a fixed viewport')
    }
    await page.setViewportSize({
      width: Math.round(viewport.width * 0.75),
      height: viewport.height,
    })
    const framesAfterResize = await settledFrames(page)
    await expectMarkersAtProjection(page, product.hotspots, 'after a stage resize')
    expect(
      await settledFrames(page),
      'the resized stage must render no frame for the markers at rest',
    ).toBe(framesAfterResize)
  })

  test(`hotspots ${slug}: after the part motion stops, the marker sits on the final pose with no further frame`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    const framesBefore = await settledFrames(page)

    // The harness control moves the part the first hotspot rides, from its
    // own frame callback, for a few frames, and stops. The marker must land
    // on the final pose: the placement runs after the render, so the last
    // motion frame already carries it, and no frame follows at rest.
    await page.getByTestId('move-part').click()
    const framesAfterMotion = await settledFrames(page)
    expect(
      framesAfterMotion,
      'the part motion must have rendered the frames it moved for',
    ).toBeGreaterThan(framesBefore)

    const moved = product.hotspots[0]
    if (moved === undefined) {
      throw new Error('the order proof needs a hotspot')
    }
    await expectMarkersAtProjection(page, [moved], "on the part's final pose")
    expect(
      await settledFrames(page),
      'no frame may render for the marker after the motion stopped',
    ).toBe(framesAfterMotion)
  })
}
