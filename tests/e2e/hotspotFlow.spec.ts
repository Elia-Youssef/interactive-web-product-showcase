import { productLoadBudgetMs } from './budgets'
import { expect, test } from './fixtures'
import { harnessPath, expectPoll, waitForProductReady } from './productSpecs'
import { dragOnCanvas, expectLensAtRest, expectOrbitAtRest, renderedFrames } from './stageCamera'
import { settledFrames } from './stageSettle'
import { applicationPlainSubjects } from './applicationPlainSubjects'
import { productPathOf } from './collectionFacts'
import {
  cardCloseButtonOf,
  cardHeadingOf,
  harnessCanvasCenter,
  harnessCanvasDrivePoint,
  harnessStageAspect,
  markerOf,
  mountedMarkerOf,
  requireCamera,
} from './hotspotViews'
import { closeWays, flowFacts } from './hotspotFlowFacts'
import {
  expectPlainCloseCameraUnchanged,
  preparePlainCloseCamera,
  readPlainCloseCamera,
} from './plainCardCamera'
// The camera flow of opening a hotspot: the card and the camera close-up
// when the model authors one for the hotspot, the open without one, the
// switch, and the four ways to close, each returning the camera or leaving
// it still by the same rule. Every test runs for each product that has the
// hotspot kind it drives, and the switch tests run for each product's
// switch pairs by transition kind, proving the camera's owed move to the
// switch target's own view: its close-up, or home when it has none. The
// card itself, its leaving and reduced motion live in hotspotCard.spec.ts,
// over the same facts module.

const facts = await flowFacts()
const { flows } = facts
const applicationPlains = applicationPlainSubjects(facts)

for (const flow of flows) {
  const { product } = flow.subject
  const slug = product.slug
  const closeUp = flow.subject.closeUps[0]
  const plain = flow.subject.plains[0]
  const appPlain = applicationPlains.plainOf(flow)

  const pressSubject = closeUp ?? plain
  if (pressSubject !== undefined) {
    test(`hotspots ${slug}: a canvas drag back to its start keeps the card open`, async ({
      page,
      backendPath,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await markerOf(page, pressSubject.title).click()
      await settledFrames(page)
      const point = await harnessCanvasDrivePoint(page)

      await page.mouse.move(point.x, point.y)
      await page.mouse.down()
      await page.mouse.move(point.x + 10, point.y)
      await page.mouse.move(point.x, point.y)
      await page.mouse.up()

      await expect(markerOf(page, pressSubject.title)).toHaveAttribute('aria-pressed', 'true')
      await expect(cardHeadingOf(page, pressSubject.title)).toHaveCount(1)
    })
  }

  if (closeUp !== undefined) {
    test(`hotspots ${slug}: opening the close-up hotspot ${closeUp.title} shows its card and eases the camera to its view`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, closeUp.title).click()
      await expect(markerOf(page, closeUp.title)).toHaveAttribute('aria-pressed', 'true')
      for (const other of product.hotspots.filter((hotspot) => hotspot.id !== closeUp.id)) {
        await expect(mountedMarkerOf(page, other.title)).toHaveAttribute('aria-pressed', 'false')
      }

      // The card carries the manifest's copy and the site's close label.
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()
      await expect(page.getByText(closeUp.eyebrow)).toBeVisible()
      for (const bullet of closeUp.bullets) {
        await expect(page.getByText(bullet)).toBeVisible()
      }
      await expect(cardCloseButtonOf(page)).toBeVisible()

      // The camera comes to rest at the authored close-up view, its lens
      // included, within the controls' rest threshold: the lens eases on the
      // zoom channel through the plan's base lens, the home view's.
      await settledFrames(page)
      const camera = await requireCamera(page)
      const expected = flow.viewAt(closeUp.view, await harnessStageAspect(page))
      expectLensAtRest(
        camera,
        flow.subject.viewFacts.home.fovY,
        expected.fovY,
        'the close-up applies the authored lens',
      )
      expectOrbitAtRest(camera, expected, 'the close-up press')
      expect(camera.position.x).toBeCloseTo(expected.position.x, 2)
      expect(camera.position.y).toBeCloseTo(expected.position.y, 2)
      expect(camera.position.z).toBeCloseTo(expected.position.z, 2)
      expect(camera.target.x).toBeCloseTo(expected.target.x, 7)
      expect(camera.target.y).toBeCloseTo(expected.target.y, 7)
      expect(camera.target.z).toBeCloseTo(expected.target.z, 7)
    })
  }

  if (appPlain !== undefined) {
    test(`hotspots ${slug}: opening the plain hotspot ${appPlain.title} shows its card and renders no frame`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize(applicationPlains.viewport)
      await page.goto(productPathOf(backendPath, product))
      await waitForProductReady(page)
      await settledFrames(page)

      const cameraBefore = await requireCamera(page)
      const framesBefore = await settledFrames(page)

      await markerOf(page, appPlain.title).click()
      await expect(markerOf(page, appPlain.title)).toHaveAttribute('aria-pressed', 'true')
      await expect(cardHeadingOf(page, appPlain.title)).toBeVisible()
      await settledFrames(page)

      // The open is not a camera move: the pose holds exactly and no frame
      // renders for it.
      const cameraAfter = await requireCamera(page)
      expect(cameraAfter.azimuth).toBeCloseTo(cameraBefore.azimuth, 9)
      expect(cameraAfter.polar).toBeCloseTo(cameraBefore.polar, 9)
      expect(cameraAfter.distance).toBeCloseTo(cameraBefore.distance, 9)
      expect(
        await renderedFrames(page),
        'opening a hotspot without a close-up must render no frame',
      ).toBe(framesBefore)
    })
  }

  for (const pair of flow.subject.switches) {
    test(`hotspots ${slug}: switching from ${pair.from.title} to ${pair.to.title} moves the camera to ${pair.to.title}'s view`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, pair.from.title).click()
      await settledFrames(page)
      await markerOf(page, pair.to.title).click()

      // One card at a time: the target's card replaces the first's.
      await expect(cardHeadingOf(page, pair.to.title)).toBeVisible()
      await expect(cardHeadingOf(page, pair.from.title)).toHaveCount(0)

      // The camera owes the switch target's own view: its close-up, or
      // home when it has none, whichever the model authors for it.
      await settledFrames(page)
      const camera = await requireCamera(page)
      const toView = flow.subject.viewOf(pair.to.id)
      const expected =
        toView !== null
          ? flow.viewAt(toView, await harnessStageAspect(page))
          : flow.homeAt(await harnessStageAspect(page))
      expectOrbitAtRest(camera, expected, `the switch to ${pair.to.title}`)
    })
  }

  if (closeUp !== undefined) {
    for (const [way, closeBy] of closeWays) {
      test(`hotspots ${slug}: closing the close-up card of ${closeUp.title} by ${way} clears the pressed state and returns the camera home`, async ({
        page,
        backendPath,
      }) => {
        await page.goto(harnessPath(backendPath, slug))
        await waitForProductReady(page)
        await settledFrames(page)

        await markerOf(page, closeUp.title).focus()
        await page.keyboard.press('Enter')
        await settledFrames(page)

        await cardCloseButtonOf(page).focus()
        await closeBy(page, closeUp.title)
        await expect(cardHeadingOf(page, closeUp.title)).toHaveCount(0)
        await expect(markerOf(page, closeUp.title)).toHaveAttribute('aria-pressed', 'false')
        // The card's close returns focus to the marker that opened it, by
        // whichever way the card closed, so a keyboard visitor never drops
        // to the body with the card.
        await expect(
          markerOf(page, closeUp.title),
          `${way} must return focus to the activating marker`,
        ).toBeFocused()

        await settledFrames(page)
        const camera = await requireCamera(page)
        expectOrbitAtRest(camera, flow.homeAt(await harnessStageAspect(page)), way)
      })
    }
  }

  if (plain !== undefined) {
    for (const [way, closeBy] of closeWays) {
      test(`hotspots ${slug}: closing the plain card of ${plain.title} by ${way} leaves the camera still`, async ({
        page,
        backendPath,
      }) => {
        await page.goto(harnessPath(backendPath, slug))
        await waitForProductReady(page)
        await preparePlainCloseCamera(page)

        await markerOf(page, plain.title).focus()
        await page.keyboard.press('Enter')
        await expect(cardHeadingOf(page, plain.title)).toBeVisible()
        const cameraBefore = await readPlainCloseCamera(page)

        await cardCloseButtonOf(page).focus()
        await closeBy(page, plain.title)
        await expect(cardHeadingOf(page, plain.title)).toHaveCount(0)
        await expect(
          markerOf(page, plain.title),
          `${way} must clear the pressed state`,
        ).toHaveAttribute('aria-pressed', 'false')
        await expect(
          markerOf(page, plain.title),
          `${way} must return focus to the activating marker`,
        ).toBeFocused()
        await expectPlainCloseCameraUnchanged(page, cameraBefore, way)
      })
    }
  }

  if (closeUp !== undefined) {
    test(`hotspots ${slug}: Escape with the card of ${closeUp.title} closed moves nothing, across a remount`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      // The close-up card opens and Escape closes it: the one listener the
      // selection registered must leave with the selection it served.
      await markerOf(page, closeUp.title).click()
      await expect(cardHeadingOf(page, closeUp.title)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(cardHeadingOf(page, closeUp.title)).toHaveCount(0)
      await settledFrames(page)

      // The product leaves and comes back within the same document: whatever
      // listens must not survive as this document's guest. A second Escape
      // while nothing is open answers with nothing (the console gate fails a
      // stale dispatch: a request without a presented plan is a console
      // error).
      await page.getByTestId('remount-product').click()
      await expectPoll(page, () => window.__viewer?.product ?? null, productLoadBudgetMs).toBe(
        'idle',
      )
      await page.keyboard.press('Escape')
      await page.getByTestId('remount-product').click()
      await waitForProductReady(page)
      await settledFrames(page)
      await expect(cardHeadingOf(page, closeUp.title)).toHaveCount(0)
      for (const hotspot of product.hotspots) {
        await expect(mountedMarkerOf(page, hotspot.title)).toHaveAttribute('aria-pressed', 'false')
      }

      // Off home, with no card open, Escape still owes no move: the stage
      // renders no frame and the camera holds the dragged pose.
      const center = await harnessCanvasCenter(page)
      await dragOnCanvas(page, center, { x: center.x + 240, y: center.y - 160 })
      const frames = await settledFrames(page)
      const dragged = await requireCamera(page)
      await page.keyboard.press('Escape')
      expect(await renderedFrames(page), 'a cardless Escape must render no frame').toBe(frames)
      const held = await requireCamera(page)
      expect(held.azimuth).toBeCloseTo(dragged.azimuth, 9)
      expect(held.polar).toBeCloseTo(dragged.polar, 9)
      expect(held.distance).toBeCloseTo(dragged.distance, 9)
    })
  }
}
