import type { Page } from '@playwright/test'

// The box of the stage on the page, in CSS pixels, as the count reads it.
export type RegionBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type BrightPixels = {
  // The count of pixels in the region whose brightest channel exceeds the
  // ceiling.
  readonly count: number
  // The total pixel count of the region.
  readonly total: number
}

export type DecodedScreenshot = {
  // The RGBA bytes of the decoded capture, row by row from the top left.
  readonly bytes: Uint8ClampedArray
  // The decoded bitmap's dimensions, for the row stride.
  readonly width: number
  readonly height: number
}

// The one page-side decode every pixel metric builds on: it draws the PNG
// into a 2d canvas once and hands the raw RGBA back to Node, so the metrics
// themselves are plain functions over bytes. A detached canvas element, not
// an OffscreenCanvas: the bundled WebKit has no OffscreenCanvas, and every
// engine has this.
export async function decodeScreenshotRGBA(
  page: Page,
  screenshot: Uint8Array,
): Promise<DecodedScreenshot> {
  return page.evaluate(async (encoded) => {
    const response = await fetch(`data:image/png;base64,${encoded}`)
    const bitmap = await createImageBitmap(await response.blob())
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
      bytes: context.getImageData(0, 0, canvas.width, canvas.height).data,
      width: canvas.width,
      height: canvas.height,
    }
  }, toBase64(screenshot))
}

// Counts the pixels of a viewport screenshot that lie in the given region
// and are brighter than the CSS backdrop can ever be. The backdrop's
// brightest pixel is a grid line: the background at rgb(16 18 18) with a
// white line at 0.025 alpha, about 22 per channel, and the vignette only
// darkens it. The ceiling sits far above that and far below the model's mid
// tones, so only model pixels can pass it. The capture must be the whole
// viewport: Chromium drops a presented WebGPU canvas from element and clip
// captures, and only the plain viewport capture carries it.
export async function countRegionPixelsBrighterThan(
  page: Page,
  screenshot: Uint8Array,
  region: RegionBox,
  ceiling: number,
): Promise<BrightPixels> {
  const decoded = await decodeScreenshotRGBA(page, screenshot)
  // The region in integer pixel coordinates, kept one pixel inside the
  // box so rounding at the edges cannot leak neighbors in.
  const left = Math.ceil(region.x) + 1
  const top = Math.ceil(region.y) + 1
  const right = Math.floor(region.x + region.width) - 1
  const bottom = Math.floor(region.y + region.height) - 1
  let count = 0
  let total = 0
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * decoded.width + x) * 4
      total += 1
      const r = decoded.bytes[index] ?? 0
      const g = decoded.bytes[index + 1] ?? 0
      const b = decoded.bytes[index + 2] ?? 0
      if (Math.max(r, g, b) > ceiling) {
        count += 1
      }
    }
  }
  return { count, total }
}

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
