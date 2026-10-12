import { expect, type Page } from '@playwright/test'
import type { DecodedScreenshot, RegionBox } from './stagePixels'
import { decodeScreenshotRGBA, backdropCeiling } from './stagePixels'
import { environmentParityBaselines } from './environmentParityBaselines'
import { test } from './fixtures'
import { loadCollection } from './productList'
import { routePath } from './appPaths'
import { waitForProductReady } from './productSpecs'
import { settledStageCapture } from './stageCapture'
import { formatProductPath } from '../../src/lib/routing'

// The environment parity gate: the stage's lighting comes from one served
// environment map, and this spec holds it to the medians measured in
// environmentParityBaselines.ts, so any change of those bytes that moves the
// lighting more than the gate allows fails on every product it moves, on
// both backends.
//
// The measurement is the masked product median: the median red, green and
// blue of the capture's pixels that are brighter than the CSS backdrop can
// ever be, inside the stage canvas. The backdrop cannot pass the ceiling and
// the masked chrome cannot either, so the medians belong to the lit product,
// and a lighting shift of the environment moves them by its own size.

// The gate in 8-bit levels per channel: the largest median shift any product
// may show against its baseline row.
const PARITY_TOLERANCE_LEVELS = 1

// The masked product medians of one decoded capture, one pixel inside the
// given box so rounding at its edges cannot leak neighbors in.
function maskedProductMedians(decoded: DecodedScreenshot, box: RegionBox) {
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  const left = Math.ceil(box.x) + 1
  const top = Math.ceil(box.y) + 1
  const right = Math.floor(box.x + box.width) - 1
  const bottom = Math.floor(box.y + box.height) - 1
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * decoded.width + x) * 4
      const r = decoded.bytes[index] ?? 0
      const g = decoded.bytes[index + 1] ?? 0
      const b = decoded.bytes[index + 2] ?? 0
      if (Math.max(r, g, b) > backdropCeiling) {
        reds.push(r)
        greens.push(g)
        blues.push(b)
      }
    }
  }
  const median = (values: number[]): number => {
    const sorted = [...values].sort((first, second) => first - second)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
  }
  return { r: median(reds), g: median(greens), b: median(blues) }
}

// The stage canvas box, the region the medians walk.
async function stageCanvasBox(page: Page): Promise<RegionBox> {
  const box = await page.locator('[data-slot="stage"] canvas').boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  return box
}

const products = (await loadCollection()).products

for (const product of products) {
  test(`environment parity ${product.slug}`, async ({ page, backendPath, expectedBackend }) => {
    const baseline = environmentParityBaselines[product.slug]?.[expectedBackend]
    if (baseline === undefined) {
      throw new Error(
        `environmentParityBaselines has no row for '${product.slug}' on ${expectedBackend}; ` +
          `measure the product's settled medians and add the row`,
      )
    }

    await page.goto(routePath(backendPath, formatProductPath(product.slug)))
    await waitForProductReady(page)

    const capture = await settledStageCapture(page, ['chromeCorners'])
    const decoded = await decodeScreenshotRGBA(page, capture)
    const measured = maskedProductMedians(decoded, await stageCanvasBox(page))

    const deltas = {
      r: Math.abs(measured.r - baseline.r),
      g: Math.abs(measured.g - baseline.g),
      b: Math.abs(measured.b - baseline.b),
    }
    const message =
      `the environment lighting of '${product.slug}' drifted on ${expectedBackend}: ` +
      `measured ${measured.r}/${measured.g}/${measured.b} against ` +
      `${baseline.r}/${baseline.g}/${baseline.b} ` +
      `(deltas ${deltas.r}/${deltas.g}/${deltas.b}, gate ${PARITY_TOLERANCE_LEVELS}); ` +
      `if the environment changed on purpose, re-measure the baseline row and explain it`
    expect(deltas.r, message).toBeLessThanOrEqual(PARITY_TOLERANCE_LEVELS)
    expect(deltas.g, message).toBeLessThanOrEqual(PARITY_TOLERANCE_LEVELS)
    expect(deltas.b, message).toBeLessThanOrEqual(PARITY_TOLERANCE_LEVELS)
  })
}
