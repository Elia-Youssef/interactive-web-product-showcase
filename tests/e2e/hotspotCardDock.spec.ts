import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { waitForProductReady } from './productSpecs'
import { loadCollection } from './productList'
import { settledFrames } from './stageSettle'
import { expectOrbitAtRest, readCamera, renderedFrames, stageAspectOfCanvas } from './stageCamera'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { closeWays, flowFacts, type HotspotFlow } from './hotspotFlowFacts'
import { viewportContracts } from './layoutContracts'

// The docked card is the same card in another place: on the layouts that
// dock every card (the phone's sheet), it keeps the flow's rules. It closes
// by Escape, by its close button and by pressing the active marker, each
// clearing the pressed state; closing a close-up card returns the camera
// home and closing a plain one moves nothing; one card is open at a time;
// under reduced motion the close-up and the return land on the next
// rendered frame; and a card that docks or changes while docked comes into
// the visitor's view however far the sheet was scrolled. The app page presents the collection's first product, so
// the cases run for every product it can present.

const collection = await loadCollection()
const { flows } = await flowFacts()
const appFlows = flows.filter((flow) => flow.subject.product.slug === collection.first.slug)
const dockingLayouts = viewportContracts.filter((contract) => contract.hotspotCard === 'docks')

for (const contract of dockingLayouts) {
  const size = `${contract.width}x${contract.height}`
  for (const flow of appFlows) {
    const { product, closeUps, plains, switches } = flow.subject
    const openDocked = async (page: Page, backendPath: string, title: string) => {
      await page.setViewportSize({ width: contract.width, height: contract.height })
      await page.goto(backendPath)
      await waitForProductReady(page)
      await settledFrames(page)
      await markerOf(page, title).click()
      await expectDockedCardOf(page, title)
    }

    for (const closeUp of closeUps.slice(0, 1)) {
      for (const [way, closeBy] of closeWays) {
        test(`docked card at ${size}: ${product.slug} closing the close-up card of ${closeUp.title} by ${way} clears the pressed state and returns the camera home`, async ({
          page,
          backendPath,
        }) => {
          await openDocked(page, backendPath, closeUp.title)
          await settledFrames(page)
          await closeBy(page, closeUp.title)
          await expectClosed(page, closeUp.title)
          await settledFrames(page)
          expectOrbitAtRest(
            await liveCamera(page),
            flow.homeAt(await stageAspectOfCanvas(page)),
            way,
          )
        })
      }
    }

    for (const plain of plains.slice(0, 1)) {
      for (const [way, closeBy] of closeWays) {
        test(`docked card at ${size}: ${product.slug} closing the plain card of ${plain.title} by ${way} clears the pressed state and moves nothing`, async ({
          page,
          backendPath,
        }) => {
          await openDocked(page, backendPath, plain.title)
          const frames = await settledFrames(page)
          await closeBy(page, plain.title)
          await expectClosed(page, plain.title)
          expect(await renderedFrames(page), `closing by ${way} must render no frame`).toBe(frames)
        })
      }
    }

    for (const hotspot of product.hotspots) {
      test(`docked card at ${size}: ${product.slug} the card of ${hotspot.title} docks into view from a sheet scrolled to its end`, async ({
        page,
        backendPath,
      }) => {
        await page.setViewportSize({ width: contract.width, height: contract.height })
        await page.goto(backendPath)
        await waitForProductReady(page)
        await settledFrames(page)
        await scrollSheetToEnd(page)
        await markerOf(page, hotspot.title).click()
        await expectDockedCardOf(page, hotspot.title)
      })
    }

    for (const pair of switches) {
      test(`docked card at ${size}: ${product.slug} switching from ${pair.from.title} to ${pair.to.title} on a scrolled sheet docks the new card into view`, async ({
        page,
        backendPath,
      }) => {
        await openDocked(page, backendPath, pair.from.title)
        await settledFrames(page)
        await scrollSheetToEnd(page)
        await markerOf(page, pair.to.title).click()
        await expectDockedCardOf(page, pair.to.title)
      })
    }

    for (const pair of switches) {
      test(`docked card at ${size}: ${product.slug} switching from ${pair.from.title} to ${pair.to.title} docks one card at a time`, async ({
        page,
        backendPath,
      }) => {
        await openDocked(page, backendPath, pair.from.title)
        await settledFrames(page)
        await markerOf(page, pair.to.title).click()
        await expectDockedCardOf(page, pair.to.title)
        await expect(cardHeadingOf(page, pair.from.title)).toHaveCount(0)
        await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
      })
    }

    for (const closeUp of closeUps.slice(0, 1)) {
      test(`docked card at ${size}: ${product.slug} under reduced motion the close-up of ${closeUp.title} and the return home land on the next rendered frame`, async ({
        page,
        backendPath,
      }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.setViewportSize({ width: contract.width, height: contract.height })
        await page.goto(backendPath)
        await waitForProductReady(page)
        const before = await settledFrames(page)
        await markerOf(page, closeUp.title).click()
        await nextRenderedFrame(page, before)
        await expectDockedCardOf(page, closeUp.title)
        await expectInstantlyAt(page, flow.viewAt(closeUp.view, await stageAspectOfCanvas(page)))

        const atCloseUp = await settledFrames(page)
        await page.getByRole('button', { name: siteCopy.closeLabel }).click()
        await nextRenderedFrame(page, atCloseUp)
        await expectClosed(page, closeUp.title)
        await expectInstantlyAt(page, flow.homeAt(await stageAspectOfCanvas(page)))
      })
    }
  }
}

async function expectDockedCardOf(page: Page, title: string): Promise<void> {
  const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
  const stage = page.getByRole('region', { name: siteCopy.stageLabel })
  const docked = panel.getByTestId('hotspot-card')
  await expect(
    docked.getByRole('heading', { name: title }),
    'the docked card is in view',
  ).toBeInViewport()
  await expect(
    docked.getByRole('button', { name: siteCopy.closeLabel }),
    'the docked close button is in view',
  ).toBeInViewport()
  await expect(stage.getByTestId('hotspot-card'), 'no card floats on the stage').toHaveCount(0)
  await expect(markerOf(page, title), 'the marker stays selected').toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

async function expectClosed(page: Page, title: string): Promise<void> {
  await expect(cardHeadingOf(page, title)).toHaveCount(0)
  await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
  await expect(markerOf(page, title)).toHaveAttribute('aria-pressed', 'false')
}

async function liveCamera(page: Page) {
  const camera = await readCamera(page)
  if (camera === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }
  return camera
}

async function nextRenderedFrame(page: Page, previous: number): Promise<void> {
  await page.waitForFunction(
    (frames: number) => (window.__viewer?.renderedFrames ?? -1) > frames,
    previous,
    { polling: 'raf' },
  )
}

// Reduced motion moves the camera instantly, so the first rendered frame
// already holds the view, to the precision the existing reduced motion
// check reads it at.
async function expectInstantlyAt(
  page: Page,
  expected: ReturnType<HotspotFlow['homeAt']>,
): Promise<void> {
  const camera = await liveCamera(page)
  expect(camera.azimuth).toBeCloseTo(expected.azimuth, 6)
  expect(camera.polar).toBeCloseTo(expected.polar, 6)
  expect(camera.distance).toBeCloseTo(expected.distance, 6)
}

// Scrolls the panel, the sheet's scroll container, to its end at once, the
// way a visitor reading the product leaves it.
async function scrollSheetToEnd(page: Page): Promise<void> {
  await page
    .getByRole('complementary', { name: siteCopy.panelLabel })
    .evaluate((panel) => panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' }))
}
