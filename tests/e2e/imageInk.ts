import { inflateSync } from 'node:zlib'

// The raster ink of a screenshot: the pixel data of a small PNG decoded in
// Node (8-bit RGB or RGBA, no interlace), so the specs can measure what an
// engine really painted over a region. Fonts and markers are checked by
// their ink, never by a style that only claims what should render.

export type DecodedImage = {
  readonly width: number
  readonly height: number
  readonly data: Buffer
}

export function decodePng(bytes: Uint8Array): DecodedImage {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []
  while (at < bytes.length) {
    const length = buffer.readUInt32BE(at)
    const type = buffer.toString('latin1', at + 4, at + 8)
    const data = buffer.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8] as number
      colorType = data[9] as number
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    at += 12 + length
    if (type === 'IEND') {
      break
    }
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `the screenshot decoder takes 8-bit RGB(A) PNGs, but got depth ${bitDepth} color type ${colorType}`,
    )
  }
  const channels = colorType === 6 ? 4 : 3
  const out = unfilterPng(inflateSync(Buffer.concat(idat)), width, height, channels)
  return { width, height, data: out }
}

// The PNG scanline filters, reversed in place into one image buffer: each
// line predicts from its left neighbor, the line above, or both.
function unfilterPng(raw: Buffer, width: number, height: number, channels: number): Buffer {
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let pos = 0
  let previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos] as number
    pos += 1
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const current = out.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? (current[x - channels] as number) : 0
      const up = previous[x] as number
      const upperLeft = x >= channels ? (previous[x - channels] as number) : 0
      let value = line[x] as number
      if (filter === 1) {
        value = (value + left) & 0xff
      } else if (filter === 2) {
        value = (value + up) & 0xff
      } else if (filter === 3) {
        value = (value + ((left + up) >> 1)) & 0xff
      } else if (filter === 4) {
        const prediction = left + up - upperLeft
        const pa = Math.abs(prediction - left)
        const pb = Math.abs(prediction - up)
        const pc = Math.abs(prediction - upperLeft)
        const nearest = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft
        value = (value + nearest) & 0xff
      }
      current[x] = value
    }
    previous = current
  }
  return out
}

// How much ink the image carries below a luminance ceiling: the darkness
// summed over every pixel darker than the ceiling, in units of one black
// pixel. A hairline weight and a missing outline read as a fraction of the
// true one.
export function inkBelow(image: DecodedImage, luminanceCeiling: number): number {
  let ink = 0
  for (let index = 0; index < image.width * image.height; index += 1) {
    const at = index * (image.data.length === image.width * image.height * 4 ? 4 : 3)
    const luminance =
      (image.data[at] as number) + (image.data[at + 1] as number) + (image.data[at + 2] as number)
    if (luminance < luminanceCeiling * 3) {
      ink += 255 * 3 - luminance
    }
  }
  return ink / (255 * 3)
}

// The ink of one element's screenshot, per pixel of its area, so elements
// of different sizes compare.
export async function inkDensityOf(
  shot: Uint8Array,
  luminanceCeiling: number,
): Promise<{ readonly ink: number; readonly pixels: number }> {
  const image = decodePng(shot)
  return { ink: inkBelow(image, luminanceCeiling), pixels: image.width * image.height }
}
