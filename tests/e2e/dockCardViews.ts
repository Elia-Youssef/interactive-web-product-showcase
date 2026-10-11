import type { Locator, Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { siteCopy } from '../../src/lib/copy/site'
import { expect } from './fixtures'
import { expectProduct, productPathOf } from './collectionFacts'
import { completedPresentation } from './presentationCompletion'
import { cardHeadingOf, markerOf, mountedMarkerOf } from './hotspotViews'
import type { CameraRead } from './stageCamera'
import { expectCardPartsInsideBand } from './cardBand'
import type { ViewportContract } from './layoutContracts'
import { selectMarkersAtCurrentView } from './markerSelection'

// The reads and drives of the dock card cases: opening a product's
// hotspot card on a docking layout, the expectations every dock case ends
// with (the whole heading and close button in the band, its marker
// selected, and the closed state after a close way), and the sheet scroll
// the scrolled sheet cases start from.

// Opens the hotspot's card from its marker on the layout, with the
// presentation settled before and after, and any step the case needs
// between the settle and the press (the plain card camera preparation).
export async function openDockedCard(
  page: Page,
  backendPath: string,
  product: Product,
  contract: ViewportContract,
  title: string,
  beforeOpen?: (page: Page) => Promise<void>,
): Promise<void> {
  await page.setViewportSize({ width: contract.width, height: contract.height })
  await page.goto(productPathOf(backendPath, product))
  await expectProduct(page, product)
  await completedPresentation(page)
  await beforeOpen?.(page)
  const hotspot = product.hotspots.find((entry) => entry.title === title)
  if (hotspot === undefined) throw new Error(`no hotspot ${title} of ${product.slug}`)
  const source = await selectMarkersAtCurrentView(page, product)
  expect(
    source.shown.has(hotspot.id),
    `the source marker ${title} of ${product.slug} is pressable at ${contract.width}x${contract.height}`,
  ).toBe(true)
  await markerOf(page, title).click()
  await completedPresentation(page)
  await expectDockedCardOf(page, title)
}

// The card of the open hotspot as the dock cases read it: its whole heading
// and close button in the panel's band, its marker selected.
export async function expectDockedCardOf(page: Page, title: string): Promise<void> {
  const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
  const stage = page.getByRole('region', { name: siteCopy.stageLabel })
  const docked = panel.getByTestId('hotspot-card')
  await completedPresentation(page)
  await expectCardPartsInsideBand([
    docked.getByRole('heading', { name: title }),
    docked.getByRole('button', { name: siteCopy.closeLabel }),
  ])
  await expect(stage.getByTestId('hotspot-card'), 'no card floats on the stage').toHaveCount(0)
  await expect(mountedMarkerOf(page, title), 'the marker stays selected').toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

// The state after a close way: no card anywhere, the marker back to rest.
export async function expectClosedCard(page: Page, title: string): Promise<void> {
  await expect(cardHeadingOf(page, title)).toHaveCount(0)
  await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
  await expect(mountedMarkerOf(page, title)).toHaveAttribute('aria-pressed', 'false')
}

// Scrolls the panel, the sheet's scroll container, to its end at once, the
// way a visitor reading the product leaves it.
export async function scrollSheetToEnd(page: Page): Promise<void> {
  await sheetOf(page).evaluate((panel) =>
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' }),
  )
}

function sheetOf(page: Page): Locator {
  return page.getByRole('complementary', { name: siteCopy.panelLabel })
}

// Observe before the native click, record its frame in capture phase, and
// copy the first subsequent rendered camera before any settle can hide an
// eased move. Copy the vectors too: later frames must not mutate the proof.
export async function cameraAfterRenderedClick(page: Page, click: () => Promise<void>) {
  const record = await page.evaluateHandle(() => ({
    sample: new Promise<{ previous: number; frame: number; camera: CameraRead }>((resolve) => {
      window.addEventListener(
        'click',
        () => {
          const previous = window.__viewer?.renderedFrames ?? -1
          const read = () => {
            const frame = window.__viewer?.renderedFrames ?? -1
            const camera = window.__viewer?.camera
            if (frame <= previous || camera === undefined || camera === null) {
              requestAnimationFrame(read)
              return
            }
            resolve({
              previous,
              frame,
              camera: { ...camera, position: { ...camera.position }, target: { ...camera.target } },
            })
          }
          requestAnimationFrame(read)
        },
        { capture: true, once: true },
      )
    }),
  }))
  try {
    await click()
    const sample = await record.evaluate((value) => value.sample)
    expect(sample.frame, 'the camera sample is from the first rendered frame after the click').toBe(
      sample.previous + 1,
    )
    return sample.camera
  } finally {
    await record.dispose()
  }
}

// Reduced motion lands the camera exactly on a view: the orbit read
// matches it to the precision the reduced motion checks read it at.
export function expectInstantlyAt(camera: CameraRead, expected: CameraRead): void {
  expect(camera.azimuth).toBeCloseTo(expected.azimuth, 6)
  expect(camera.polar).toBeCloseTo(expected.polar, 6)
  expect(camera.distance).toBeCloseTo(expected.distance, 6)
  expect(camera.fovY).toBeCloseTo(expected.fovY, 6)
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(camera.target[axis]).toBeCloseTo(expected.target[axis], 6)
    expect(camera.position[axis]).toBeCloseTo(expected.position[axis], 6)
  }
}
