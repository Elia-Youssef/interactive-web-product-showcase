import { expect, test } from './fixtures'
import { expectProduct, productPathOf } from './collectionFacts'
import { shippedProducts } from './productSpecs'
import { settledFrames } from './stageSettle'
import { flowFacts } from './hotspotFlowFacts'
import { decodePng } from './imageInk'
import { elementCapture } from './stageCapture'

// The inactive marker reads on any surface the product can put under it:
// the lightest and the darkest finish of every routed product, from the
// manifests' own swatch colors, with the page's real marker (its own
// stylesheet classes, cloned) over a surface of exactly that color. The
// 3D surface under a live marker shades and moves with the light, so the
// contrast against the finish itself is measured on this fixture, where
// the finish is the finish: the marker's darkest or lightest point inside
// its ring must stand off the surface by the non-text contrast floor. The
// off-white dot answers on dark surfaces, and the dot's black rim answers
// on light ones, so one marker reads everywhere and the accent stays the
// only color.

// WCAG's non-text contrast floor.
const CONTRAST_FLOOR = 3

// The relative luminance of an sRGB channel per WCAG.
function luminanceOf(red: number, green: number, blue: number): number {
  const channel = (value: number): number => {
    const scaled = value / 255
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

function contrast(a: number, b: number): number {
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

// The marker's reading over a known surface, from a screenshot of the
// fixture: the surface answers from the fixture's corners, outside the
// marker, and the marker's extreme luminance inside its ring stands off
// it, whichever extreme is stronger.
async function markerContrastOver(shot: Uint8Array): Promise<number> {
  const image = decodePng(shot)
  const { width, height, data } = image
  const channels = data.length === width * height * 4 ? 4 : 3
  const at = (x: number, y: number): number =>
    luminanceOf(
      data[(y * width + x) * channels] as number,
      data[(y * width + x) * channels + 1] as number,
      data[(y * width + x) * channels + 2] as number,
    )

  const inset = Math.round(Math.min(width, height) * 0.06)
  const surfaces: number[] = []
  for (const [x, y] of [
    [inset, inset],
    [width - inset, inset],
    [inset, height - inset],
    [width - inset, height - inset],
  ] as const) {
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -2; dy <= 2; dy += 1) {
        surfaces.push(at(x + dx, y + dy))
      }
    }
  }
  surfaces.sort((a, b) => a - b)
  const surface = surfaces[Math.floor(surfaces.length / 2)] as number

  let extreme = surface
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.32
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius * radius) {
        continue
      }
      const luminance = at(x, y)
      if (contrast(luminance, surface) > contrast(extreme, surface)) {
        extreme = luminance
      }
    }
  }
  return contrast(extreme, surface)
}

// The finishes of a product at the ends of its swatch luminance.
function extremeFinishesOf(product: {
  readonly finishes: readonly { readonly label: string; readonly swatch: string }[]
}): readonly { readonly label: string; readonly swatch: string }[] {
  const ordered = [...product.finishes].sort(
    (a, b) => luminanceOfHex(b.swatch) - luminanceOfHex(a.swatch),
  )
  const lightest = ordered[0]
  const darkest = ordered.at(-1)
  if (lightest === undefined || darkest === undefined) {
    throw new Error('a product must carry finishes to measure marker contrast')
  }
  return [lightest, darkest]
}

function luminanceOfHex(hex: string): number {
  const parsed = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (parsed === null || parsed[1] === undefined) {
    throw new Error(`the swatch '${hex}' is not a 6-digit hex color`)
  }
  const value = Number.parseInt(parsed[1], 16)
  return luminanceOf((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff)
}

const { flows } = await flowFacts(await shippedProducts())

for (const flow of flows) {
  const { product } = flow.subject
  for (const finish of extremeFinishesOf(product)) {
    test(`marker contrast: ${product.slug} on ${finish.label} keeps the inactive marker readable`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(productPathOf(backendPath, product))
      await expectProduct(page, product)
      await settledFrames(page)

      // The fixture: one of the page's own markers, cloned centered on a
      // surface of the finish's swatch color, sized a few hit areas wide so
      // the surface answers around the marker.
      const fixture = page.locator('[data-marker-fixture]')
      await page.evaluate(
        ({ color }) => {
          const marker = document.querySelector('[data-slot="stage"] button[aria-pressed]')
          if (marker === null) {
            throw new Error('the stage must show a marker to clone')
          }
          const host = document.createElement('div')
          host.dataset.markerFixture = ''
          host.style.position = 'fixed'
          host.style.insetInlineStart = '0'
          host.style.insetBlockStart = '0'
          host.style.inlineSize = '200px'
          host.style.blockSize = '200px'
          host.style.backgroundColor = color
          host.style.zIndex = '9999'
          const clone = marker.cloneNode(true)
          if (!(clone instanceof HTMLElement)) {
            throw new Error('the marker clone must be an element')
          }
          clone.style.position = 'absolute'
          clone.style.insetBlockStart = '78px'
          clone.style.insetInlineStart = '78px'
          host.appendChild(clone)
          document.body.appendChild(host)
        },
        { color: finish.swatch },
      )
      const measured = await markerContrastOver(await elementCapture(page, fixture))
      await page.evaluate(() => document.querySelector('[data-marker-fixture]')?.remove())
      expect(
        measured,
        `the marker over ${product.slug} ${finish.label} (${finish.swatch}) must stand off the finish by ${CONTRAST_FLOOR}:1`,
      ).toBeGreaterThanOrEqual(CONTRAST_FLOOR)
    })
  }
}
