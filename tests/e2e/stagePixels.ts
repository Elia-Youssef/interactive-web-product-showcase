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

// Counts the pixels of a viewport screenshot that lie in the given region
// and are brighter than the CSS backdrop can ever be. The backdrop's
// brightest pixel is a grid line: the background at rgb(16 18 18) with a
// white line at 0.025 alpha, about 22 per channel, and the vignette only
// darkens it. The ceiling sits far above that and far below the model's mid
// tones, so only model pixels can pass it. The capture must be the whole
// viewport: Chromium drops a presented WebGPU canvas from element and clip
// captures, and only the plain viewport capture carries it. The decode runs
// in the page, which draws the PNG into a 2d canvas; the callback is
// serialized, so it carries its own decode.
export async function countRegionPixelsBrighterThan(
  page: Page,
  screenshot: Uint8Array,
  region: RegionBox,
  ceiling: number,
): Promise<BrightPixels> {
  return page.evaluate(
    async (probe) => {
      const encoded = probe[0]
      if (encoded === undefined) {
        throw new Error('the screenshot must arrive for the count')
      }
      const region = probe[1]
      const ceiling = probe[2] ?? 0
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
      const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data
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
          const index = (y * canvas.width + x) * 4
          total += 1
          if (Math.max(...bytes.subarray(index, index + 3)) > ceiling) {
            count += 1
          }
        }
      }
      return { count, total }
    },
    [toBase64(screenshot), region, ceiling] as const,
  )
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
