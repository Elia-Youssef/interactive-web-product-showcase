import type { Document } from '@gltf-transform/core'
import { createDefaultContainer, write, VK_FORMAT_R8G8B8A8_UNORM } from 'ktx-parse'
import type { AlphaGrid, ShadowPlane } from './shadowFootprint.ts'
import { SHADOW_SETTINGS } from './shadowSettings.ts'
import { nodeNamed } from './validateFixtures.ts'

export function rectangularAlpha(
  width: number,
  height: number,
  region: { x: readonly [number, number]; y: readonly [number, number] },
): AlphaGrid {
  const alpha = new Float64Array(width * height)
  for (let y = region.y[0]; y < region.y[1]; y += 1) {
    for (let x = region.x[0]; x < region.x[1]; x += 1) alpha[y * width + x] = 1
  }
  return { width, height, alpha }
}

// All dimensions derive from the shared pad. The clean plane's sides sit
// eleven texels inside alpha plus pad, just below the shipped-byte limit.
export function shadowFixture(
  growTexels = 0,
  shrinkTexels = 0,
): { grid: AlphaGrid; plane: ShadowPlane } {
  const width = 64
  const texelM = SHADOW_SETTINGS.padM / 27
  const spanM = width * texelM
  const low = shrinkTexels * texelM,
    high = spanM - low
  return {
    grid: rectangularAlpha(width, width, {
      x: [16 - growTexels, 48 + growTexels],
      y: [16 - growTexels, 48 + growTexels],
    }),
    plane: {
      boundsM: { x: [low, high], y: [low, high] },
      uvBoundsM: { x: [low, high], y: [high, low] },
    },
  }
}

export function rawAlphaKtx(grid: AlphaGrid): Uint8Array {
  const container = createDefaultContainer()
  container.vkFormat = VK_FORMAT_R8G8B8A8_UNORM
  container.pixelWidth = grid.width
  container.pixelHeight = grid.height
  const rgba = new Uint8Array(grid.width * grid.height * 4)
  for (let i = 0; i < grid.alpha.length; i += 1)
    rgba[i * 4 + 3] = Math.round((grid.alpha[i] ?? 0) * 255)
  container.levels = [{ levelData: rgba, uncompressedByteLength: rgba.length }]
  return write(container)
}

export function setShadowFixture(doc: Document, growTexels = 0, shrinkTexels = 0): void {
  const { grid, plane } = shadowFixture(growTexels, shrinkTexels)
  const primitive = nodeNamed(doc, 'SHADOW').getMesh()?.listPrimitives()[0]
  const buffer = doc.getRoot().listBuffers()[0]
  const material = primitive?.getMaterial()
  if (
    primitive === undefined ||
    buffer === undefined ||
    material === null ||
    material === undefined
  )
    throw new Error('missing fixture shadow')
  const [x0, x1] = plane.boundsM.x,
    [y0, y1] = plane.boundsM.y
  primitive.setAttribute(
    'POSITION',
    doc
      .createAccessor()
      .setBuffer(buffer)
      .setType('VEC3')
      .setArray(new Float32Array([x0, 0, -y0, x1, 0, -y0, x0, 0, -y1, x1, 0, -y1])),
  )
  primitive.setAttribute(
    'TEXCOORD_0',
    doc
      .createAccessor()
      .setBuffer(buffer)
      .setType('VEC2')
      .setArray(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0])),
  )
  material.setBaseColorTexture(
    doc.createTexture('T_shadow').setMimeType('image/ktx2').setImage(rawAlphaKtx(grid)),
  )
}
