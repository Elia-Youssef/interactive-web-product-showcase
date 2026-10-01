import type { Page } from '@playwright/test'
import type { RegionBox } from './stagePixels'

// The pixel evidence of a finish switch: two captures are compared over the
// stage box, and the pixels that differ are the change the switch painted.
// The thresholds live in the run itself: the same-finish capture pair of
// the same page is the noise reference, so nothing here is tuned against a
// fixed ceiling.

export type FinishPixelChange = {
  // Pixels of the region that differ between the captures in any channel.
  readonly changedPixels: number
  // The mean brightest-channel value of the first capture over exactly
  // those pixels: the brightness of the surface the change covers.
  readonly meanFirst: number
  // The same mean for the second capture.
  readonly meanSecond: number
}

// Compares two captures in the page. The page function carries its own
// decoding, since nothing else crosses the wire with it.
export async function measureFinishChange(
  page: Page,
  first: Uint8Array,
  second: Uint8Array,
  region: RegionBox,
): Promise<FinishPixelChange> {
  return page.evaluate(countChangedPixelsIn, [
    toBase64(first),
    toBase64(second),
    Math.ceil(region.x) + 1,
    Math.ceil(region.y) + 1,
    Math.floor(region.x + region.width) - 1,
    Math.floor(region.y + region.height) - 1,
  ] as const)
}

type PixelProbe = readonly [
  first: string,
  second: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
]

async function countChangedPixelsIn(probe: PixelProbe): Promise<FinishPixelChange> {
  const [firstEncoded, secondEncoded, left, top, right, bottom] = probe
  if (firstEncoded === undefined || secondEncoded === undefined || left === undefined) {
    throw new Error('the captures and the region must arrive for the count')
  }
  const decode = async (encoded: string): Promise<Decoded> => {
    const response = await fetch(`data:image/png;base64,${encoded}`)
    const bitmap = await createImageBitmap(await response.blob())
    // A detached canvas element, not an OffscreenCanvas: the bundled WebKit
    // has no OffscreenCanvas, and every engine has this.
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('the page offers no 2d context to decode a screenshot with')
    }
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    return {
      width: canvas.width,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    }
  }
  const bright = (image: Decoded, index: number) =>
    Math.max(image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0)
  const differs = (a: Decoded, b: Decoded, index: number) =>
    (a.data[index] ?? 0) !== (b.data[index] ?? 0) ||
    (a.data[index + 1] ?? 0) !== (b.data[index + 1] ?? 0) ||
    (a.data[index + 2] ?? 0) !== (b.data[index + 2] ?? 0)
  const first = await decode(firstEncoded)
  const second = await decode(secondEncoded)
  let changedPixels = 0
  let firstSum = 0
  let secondSum = 0
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * first.width + x) * 4
      if (differs(first, second, index)) {
        changedPixels += 1
        firstSum += bright(first, index)
        secondSum += bright(second, index)
      }
    }
  }
  return {
    changedPixels,
    meanFirst: changedPixels === 0 ? 0 : firstSum / changedPixels,
    meanSecond: changedPixels === 0 ? 0 : secondSum / changedPixels,
  }
}

type Decoded = { readonly width: number; readonly data: Uint8ClampedArray }

// Base64 over the wire, in chunks, from raw PNG bytes: the encode runs
// outside the page, so it uses neither Node's Buffer nor the page.
function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize))
  }
  return btoa(binary)
}
