import { decodePng, type DecodedImage } from './imageInk'
import type { RegionBox } from './stagePixels'

// Compare captures over the same surface. Weighted encoded RGB is a luma
// metric, not linear-light luminance; saturated colors retain their channel
// weights instead of being ranked by whichever channel happens to peak.
export type FinishPixelChange = {
  readonly changedPixels: number
  readonly meanFirst: number
  readonly meanSecond: number
}

export function measureFinishChange(
  first: Uint8Array,
  second: Uint8Array,
  region: RegionBox,
): FinishPixelChange {
  return countFinishPixels(decodePng(first), decodePng(second), region)
}

export function countFinishPixels(
  first: DecodedImage,
  second: DecodedImage,
  region: RegionBox,
): FinishPixelChange {
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error('finish captures must have the same dimensions')
  }
  let changedPixels = 0
  let firstSum = 0
  let secondSum = 0
  for (let y = Math.ceil(region.y) + 1; y < Math.floor(region.y + region.height) - 1; y += 1) {
    for (let x = Math.ceil(region.x) + 1; x < Math.floor(region.x + region.width) - 1; x += 1) {
      const a = rgbAt(first, x, y)
      const b = rgbAt(second, x, y)
      if (a.some((channel, index) => channel !== b[index])) {
        changedPixels += 1
        firstSum += luma(a)
        secondSum += luma(b)
      }
    }
  }
  return {
    changedPixels,
    meanFirst: changedPixels === 0 ? 0 : firstSum / changedPixels,
    meanSecond: changedPixels === 0 ? 0 : secondSum / changedPixels,
  }
}

type Rgb = readonly [number, number, number]

function rgbAt(image: DecodedImage, x: number, y: number): Rgb {
  const channels = image.data.length / (image.width * image.height)
  const at = (y * image.width + x) * channels
  return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0]
}

function luma([red, green, blue]: Rgb): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
