import type { DecodedScreenshot, RegionBox } from './stagePixels'
import { decodeScreenshotRGBA } from './stagePixels'

// The pixel measurements of the look specs: every metric below is a plain
// function over decoded capture bytes, so the specs compare exact counts and
// sums against their own measured noise, with no tuned threshold. The
// captures decode once through the shared stage pixels helper.

// The sum of the channel values over the canvas box: an integer, so the
// brighter/darker comparisons the specs make are exact.
export function boxChannelSum(decoded: DecodedScreenshot, box: RegionBox): number {
  let sum = 0
  forEachBoxPixel(decoded, box, (index) => {
    sum += channelSum(decoded, index)
  })
  return sum
}

export type PixelDiff = {
  // The count of pixels in the box where any channel of the two decoded
  // captures differs.
  readonly count: number
}

// The pixels two captures of the same viewport disagree on: the noise of a
// determinism pair, the size of an effect. Exact, with no tolerance.
export function countDifferingPixels(
  first: DecodedScreenshot,
  second: DecodedScreenshot,
  box: RegionBox,
): PixelDiff {
  let count = 0
  forEachBoxPixel(first, box, (index) => {
    if (channelSum(first, index) !== channelSum(second, index)) {
      count += 1
      return
    }
    for (let channel = 0; channel < 3; channel += 1) {
      if (first.bytes[index + channel] !== second.bytes[index + channel]) {
        count += 1
        return
      }
    }
  })
  return { count }
}

export type ChangeMass = {
  // The count of pixels in the box where the two decoded captures differ.
  readonly count: number
  // The summed darkening of the pixels that darkened, and the summed
  // brightening of the pixels that brightened, in channel-sum levels. Both
  // are exact integers; the specs read their ratio, never a margin against
  // a tuned number.
  readonly darkenedSum: number
  readonly brightenedSum: number
}

// The mass of the change between two captures, split by direction. The
// split is necessary because a baked shadow's opacity is not the only thing
// an opacity step moves: at the product's antialiased silhouette a pixel is
// partly product and partly shadow over the backdrop, and raising the
// shadow's alpha raises that pixel's premultiplied alpha, which the output
// pass's unpremultiply, tone map, sRGB convert and premultiply roundtrip
// (node_modules/three/src/nodes/display/RenderOutputNode.js:108-141) turns
// into real brightening of the product's own contribution - the transfer
// function is concave, so a larger alpha multiplies a darker unpremultiplied
// color back to a larger premultiplied one.
export function countDifferingPixelsByDirection(
  first: DecodedScreenshot,
  second: DecodedScreenshot,
  box: RegionBox,
): ChangeMass {
  let count = 0
  let darkenedSum = 0
  let brightenedSum = 0
  forEachBoxPixel(first, box, (index) => {
    const delta = channelSum(first, index) - channelSum(second, index)
    if (delta === 0) {
      // Equal sums can still hide opposite channel changes; they belong to
      // the same silhouette effect and carry no mass either way.
      for (let channel = 0; channel < 3; channel += 1) {
        if (first.bytes[index + channel] !== second.bytes[index + channel]) {
          count += 1
          return
        }
      }
      return
    }
    count += 1
    if (delta < 0) {
      darkenedSum += -delta
    } else {
      brightenedSum += delta
    }
  })
  return { count, darkenedSum, brightenedSum }
}

function channelSum(decoded: DecodedScreenshot, index: number): number {
  return (
    (decoded.bytes[index] ?? 0) + (decoded.bytes[index + 1] ?? 0) + (decoded.bytes[index + 2] ?? 0)
  )
}

// Walks the box's pixels, kept one pixel inside so rounding at the edges
// cannot leak neighbors in.
function forEachBoxPixel(
  decoded: DecodedScreenshot,
  box: RegionBox,
  visit: (index: number) => void,
): void {
  const left = Math.ceil(box.x) + 1
  const top = Math.ceil(box.y) + 1
  const right = Math.floor(box.x + box.width) - 1
  const bottom = Math.floor(box.y + box.height) - 1
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      visit((y * decoded.width + x) * 4)
    }
  }
}

export { decodeScreenshotRGBA }
