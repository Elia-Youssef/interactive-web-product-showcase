import { read, VK_FORMAT_R8G8B8A8_UNORM, VK_FORMAT_R8G8B8A8_SRGB } from 'ktx-parse'
import { loadBasisTranscoder } from './basisTranscoder.ts'
import type { BasisFile } from './basisTranscoder.ts'
import type { AlphaGrid } from './shadowFootprint.ts'

const RGBA32_FORMAT = 13

// The caller owns the decoder and its WASM memory, which can be reused
// across images without retaining a module singleton.
export function createShadowAlphaReader(): (bytes: Uint8Array) => Promise<AlphaGrid> {
  let basis: ReturnType<typeof loadBasisTranscoder> | undefined
  return async (bytes) => {
    const container = read(bytes)
    if (
      container.pixelDepth !== 0 ||
      container.layerCount !== 0 ||
      container.faceCount !== 1 ||
      container.levels.length === 0
    ) {
      throw new Error('shadow image must be a non-array 2D KTX2 texture with mip zero')
    }
    let rgba: Uint8Array
    if (
      container.vkFormat === VK_FORMAT_R8G8B8A8_UNORM ||
      container.vkFormat === VK_FORMAT_R8G8B8A8_SRGB
    ) {
      const level = container.levels[0]
      if (container.supercompressionScheme !== 0 || level === undefined)
        throw new Error('raw shadow RGBA must be uncompressed')
      rgba = level.levelData
    } else {
      basis ??= loadBasisTranscoder()
      rgba = transcodeRgba(new (await basis).KTX2File(bytes))
    }
    const { pixelWidth: width, pixelHeight: height } = container
    if (rgba.length !== width * height * 4)
      throw new Error('shadow mip zero RGBA size does not match its dimensions')
    const alpha = Float64Array.from(
      { length: width * height },
      (_, i) => (rgba[i * 4 + 3] ?? 0) / 255,
    )
    return { width, height, alpha }
  }
}

function transcodeRgba(file: BasisFile): Uint8Array {
  try {
    if (!file.isValid() || !file.isETC1S() || !file.getHasAlpha() || !file.startTranscoding()) {
      throw new Error('shadow image must contain valid ETC1S alpha')
    }
    const rgba = new Uint8Array(file.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32_FORMAT))
    if (!file.transcodeImage(rgba, 0, 0, 0, RGBA32_FORMAT, 0, -1, -1))
      throw new Error('shadow mip zero transcode failed')
    return rgba
  } finally {
    file.close()
    file.delete()
  }
}
