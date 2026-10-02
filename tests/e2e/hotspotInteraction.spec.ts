import { expect, test } from './fixtures'
import { testBodyBudgetMs, testBudgetMs } from './budgets'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { readProductHotspotFacts } from './productHotspots'
import type { ProductHotspotFacts } from './productHotspots'
import { readProductViewFacts } from './productCamera'
import { settledFrames } from './stageSettle'
import { renderedFrames } from './stageCamera'
import {
  dragToAzimuth,
  dragToPolarAtMost,
  driveToHidingView,
  oppositeAzimuthOf,
} from './hotspotDrives'
import { markerOf, occludableFact, pointOf, requireCamera } from './hotspotViews'

// The pulse animations of one marker, read through the Web Animations API.
// The marker subtree carries exactly one animation, the pulse; its keyframes
// name is module-scoped, so the reads count and measure the animations
// instead of matching the name.
function pulseAnimations(page: Parameters<typeof markerOf>[0], title: string) {
  return markerOf(page, title).evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation): animation is CSSAnimation => 'animationName' in animation),
  )
}

function pulseStartTimes(page: Parameters<typeof markerOf>[0], title: string): Promise<number[]> {
  return pulseAnimations(page, title).then((animations) =>
    animations.map((animation) => Number(animation.startTime)),
  )
}
// The interaction halves of the hotspot specs: the press contract (a press
// without a close-up leaves the camera still, a press with one moves the
// camera), and the one first-load pulse that an occlusion round trip never
// replays and reduced motion never shows. The open card and its camera
// close-up live in hotspotFlow.spec.ts.

const products = await harnessProducts()
const factsBySlug = new Map<string, ProductHotspotFacts>()
const viewFactsBySlug = new Map<string, Awaited<ReturnType<typeof readProductViewFacts>>>()
for (const product of products) {
  factsBySlug.set(product.slug, await readProductHotspotFacts(product.slug, product))
  viewFactsBySlug.set(product.slug, await readProductViewFacts(product.slug))
}

for (const product of products) {
  const facts = factsBySlug.get(product.slug)
  if (facts === undefined) {
    throw new Error(`no hotspot facts for ${product.slug}`)
  }
  const viewFacts = viewFactsBySlug.get(product.slug)
  if (viewFacts === undefined) {
    throw new Error(`no camera view facts for ${product.slug}`)
  }
  // The press proof needs one hotspot without a close-up, whose opening is
  // no camera move, and one with, whose opening moves the camera. A product
  // missing either has no contrast to prove.
  const plain = product.hotspots.find((hotspot) => !viewFacts.closeUps.has(hotspot.id))
  const closeUp = product.hotspots.find((hotspot) => viewFacts.closeUps.has(hotspot.id))
  if (plain === undefined) {
    throw new Error(`the press proof needs a hotspot without a close-up in ${product.slug}`)
  }
  if (closeUp === undefined) {
    throw new Error(`the press proof needs a hotspot with a close-up in ${product.slug}`)
  }
  const slug = product.slug

  test(`hotspots ${slug}: pressing the marker without a close-up presses it alone in the red token, and the camera stays put`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const cameraBefore = await requireCamera(page)
    const framesBefore = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)

    await markerOf(page, plain.title).click()
    await expect(markerOf(page, plain.title)).toHaveAttribute('aria-pressed', 'true')
    for (const other of product.hotspots.filter((hotspot) => hotspot.id !== plain.id)) {
      await expect(markerOf(page, other.title)).toHaveAttribute('aria-pressed', 'false')
    }

    // The dot's computed color is the red token, read from the tokens
    // themselves so no hand-typed color enters the expectation. The dot
    // lifts through the state transition token (150ms), so the read polls
    // past it.
    const redToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--red').trim(),
    )
    expect(redToken).toMatch(/^#[0-9a-f]{6}$/i)
    const redAsRgb = `rgb(${redToken
      .slice(1)
      .match(/../g)
      ?.map((hex) => Number.parseInt(hex, 16))
      .join(', ')})`
    await expect
      .poll(
        () =>
          markerOf(page, plain.title).evaluate(
            (element) => getComputedStyle(element, '::after').backgroundColor,
          ),
        { message: 'the pressed marker dot must be the red token', timeout: testBodyBudgetMs },
      )
      .toBe(redAsRgb)

    // A press without a close-up is not a drag and not a camera move: the
    // camera holds, and the press renders no frame.
    const cameraAfter = await requireCamera(page)
    expect(cameraAfter.azimuth).toBeCloseTo(cameraBefore.azimuth, 9)
    expect(cameraAfter.polar).toBeCloseTo(cameraBefore.polar, 9)
    expect(cameraAfter.distance).toBeCloseTo(cameraBefore.distance, 9)
    expect(
      await page.evaluate(() => window.__viewer?.renderedFrames ?? -1),
      'a press without a close-up must render no frame',
    ).toBe(framesBefore)

    // Pressing the active marker clears the selection, and the dot leaves
    // the red token, through the same transition.
    await markerOf(page, plain.title).click()
    await expect(markerOf(page, plain.title)).toHaveAttribute('aria-pressed', 'false')
    for (const other of product.hotspots.filter((hotspot) => hotspot.id !== plain.id)) {
      await expect(markerOf(page, other.title)).toHaveAttribute('aria-pressed', 'false')
    }
    await expect
      .poll(
        () =>
          markerOf(page, plain.title).evaluate(
            (element) => getComputedStyle(element, '::after').backgroundColor,
          ),
        { message: 'the cleared marker dot must not stay red', timeout: testBodyBudgetMs },
      )
      .not.toBe(redAsRgb)
  })

  test(`hotspots ${slug}: pressing the marker with a close-up presses it and moves the camera`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const framesBefore = await settledFrames(page)
    const cameraBefore = await requireCamera(page)

    await markerOf(page, closeUp.title).click()
    await expect(markerOf(page, closeUp.title)).toHaveAttribute('aria-pressed', 'true')

    // A press whose hotspot has a close-up owes the camera the move: the
    // stage renders for the eased approach and comes to rest elsewhere.
    await settledFrames(page)
    expect(
      await renderedFrames(page),
      'a press with a close-up must render the frames of its move',
    ).toBeGreaterThan(framesBefore)
    const cameraAfter = await requireCamera(page)
    const moved =
      Math.abs(cameraAfter.azimuth - cameraBefore.azimuth) +
      Math.abs(cameraAfter.polar - cameraBefore.polar) +
      Math.abs(cameraAfter.distance - cameraBefore.distance)
    expect(moved, 'the close-up press must have moved the camera').toBeGreaterThan(0)
  })

  test(`hotspots ${slug}: each marker pulses exactly once after load, and an occlusion round trip replays nothing`, async ({
    page,
    backendPath,
  }) => {
    // One load and four camera drives: the occlusion round trip to the
    // hiding view and back home, each an azimuth drive and a polar drive.
    test.setTimeout(testBudgetMs({ productLoads: 1, cameraDrives: 4 }))
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const startTimesAtLoad = new Map<string, number[]>()
    for (const hotspot of product.hotspots) {
      const times = await pulseStartTimes(page, hotspot.title)
      expect(times, `${hotspot.title} must run exactly one pulse after load`).toHaveLength(1)
      startTimesAtLoad.set(hotspot.title, times)
    }

    // The round trip: to the body's hiding view and back. Hiding is
    // visibility, never display, so the pulse animation survives it and
    // never restarts. The hiding view is the same geometry the placement
    // spec drives: the opposite azimuth, at the camera height the facts
    // found by raycasting the shipped meshes.
    const occluded = occludableFact(facts)
    const occludedTitle = product.hotspots.find((h) => h.id === occluded.id)?.title
    if (occludedTitle === undefined) {
      throw new Error(`no manifest hotspot '${occluded.id}'`)
    }
    const hidingHeightM = occluded.hidingHeightM
    if (hidingHeightM === null) {
      throw new Error(`the facts found no hiding height for ${occluded.id}`)
    }
    const cameraAtHome = await requireCamera(page)
    const hidingPolar = Math.acos((hidingHeightM - cameraAtHome.target.y) / cameraAtHome.distance)
    await driveToHidingView(
      page,
      oppositeAzimuthOf(cameraAtHome, pointOf(occluded.stagePosition)),
      hidingPolar,
    )
    await expect(
      markerOf(page, occludedTitle),
      'the round trip must pass a hiding view',
    ).toBeHidden()
    await dragToAzimuth(page, cameraAtHome.azimuth)
    await dragToPolarAtMost(page, cameraAtHome.polar)
    await settledFrames(page)

    for (const hotspot of product.hotspots) {
      const times = await pulseStartTimes(page, hotspot.title)
      expect(times, `${hotspot.title} must still carry its one pulse after the round trip`).toEqual(
        startTimesAtLoad.get(hotspot.title),
      )
    }
  })

  test(`hotspots ${slug}: reduced motion resolves the pulse to none`, async ({
    page,
    backendPath,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(harnessPath(backendPath, slug))
    await waitForProductReady(page)
    await settledFrames(page)

    for (const hotspot of product.hotspots) {
      const state = await markerOf(page, hotspot.title).evaluate((element) => {
        const pulse = element.lastElementChild
        return {
          durations: [...element.getAnimations({ subtree: true })]
            .filter((animation): animation is CSSAnimation => 'animationName' in animation)
            .map((animation) => animation.effect?.getTiming().duration),
          // The visible truth: the pulse ring at its forwards fill, the
          // state the zero duration lands it in at once.
          pulseOpacity: pulse === null ? null : getComputedStyle(pulse).opacity,
        }
      })
      for (const duration of state.durations) {
        expect(duration, `${hotspot.title} must run no visible pulse under reduced motion`).toBe(0)
      }
      expect(
        state.pulseOpacity,
        `${hotspot.title}'s pulse ring must show nothing under reduced motion`,
      ).toBe('0')
    }
  })
}
