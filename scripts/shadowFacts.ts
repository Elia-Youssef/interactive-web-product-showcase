// Read the plane through the full node chain, including quantization
// wrappers. Blender's floor axes are glTF world X and minus world Z.
import type { Document, Node, Primitive } from '@gltf-transform/core'
import { SHADOW_NODE_NAME } from '../src/lib/product/contractNames.ts'
import { transformPointOf, type Vec3 } from '../src/lib/camera/frame.ts'
import { posedWorldMatricesOf } from './nodePoses.ts'
import { createShadowAlphaReader } from './shadowAlpha.ts'
import { measureShadowFootprint, type AlphaGrid, type ShadowPlane } from './shadowFootprint.ts'
import { SHADOW_SETTINGS } from './shadowSettings.ts'

export type ShadowFacts =
  | { readonly kind: 'measured'; readonly plane: ShadowPlane; readonly grid: AlphaGrid }
  | { readonly kind: 'problem'; readonly reason: string }

export async function readShadowFacts(
  doc: Document,
  decode = createShadowAlphaReader(),
): Promise<ShadowFacts> {
  try {
    const { node, primitive } = shadowPrimitive(doc)
    const material = primitive.getMaterial()
    const texture = material?.getBaseColorTexture()
    const bytes = texture?.getImage()
    const info = material?.getBaseColorTextureInfo()
    if (bytes === undefined || bytes === null || texture?.getMimeType() !== 'image/ktx2') {
      throw new Error('SHADOW must have a KTX2 base color image')
    }
    if (info?.getExtension('KHR_texture_transform') !== null)
      throw new Error('SHADOW must map its image without a texture transform')
    const plane = readShadowPlane(doc, node, primitive, info?.getTexCoord() ?? 0)
    const grid = await decode(bytes)
    measureShadowFootprint(grid, plane, SHADOW_SETTINGS)
    return { kind: 'measured', plane, grid }
  } catch (error) {
    return { kind: 'problem', reason: error instanceof Error ? error.message : String(error) }
  }
}

function shadowPrimitive(doc: Document): { node: Node; primitive: Primitive } {
  const roots = doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getName() === SHADOW_NODE_NAME)
  const root = roots[0]
  if (roots.length !== 1 || root === undefined) throw new Error('expected exactly one SHADOW node')
  const meshes: Node[] = []
  root.traverse((node) => {
    if (node.getMesh() !== null) meshes.push(node)
  })
  const node = meshes[0]
  const primitives = node?.getMesh()?.listPrimitives() ?? []
  const primitive = primitives[0]
  if (
    meshes.length !== 1 ||
    primitives.length !== 1 ||
    node === undefined ||
    primitive === undefined
  ) {
    throw new Error('expected exactly one SHADOW primitive through its node chain')
  }
  return { node, primitive }
}

function readShadowPlane(
  doc: Document,
  node: Node,
  primitive: Primitive,
  texCoord: number,
): ShadowPlane {
  const positions = primitive.getAttribute('POSITION')
  const uvs = primitive.getAttribute(`TEXCOORD_${texCoord}`)
  const world = posedWorldMatricesOf(doc, []).get(node)
  if (
    positions === null ||
    uvs === null ||
    positions.getCount() !== uvs.getCount() ||
    positions.getCount() < 4 ||
    world === undefined
  ) {
    throw new Error('SHADOW must have matching plane positions and texture UVs')
  }
  const points: Vec3[] = [],
    coordinates: number[][] = []
  for (let i = 0; i < positions.getCount(); i += 1) {
    const position = positions.getElement(i, [])
    points.push(transformPointOf(world, [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0]))
    coordinates.push(uvs.getElement(i, []))
  }
  const xs = points.map((point) => point[0]),
    ys = points.map((point) => -point[2])
  const x = axisMapping(
    coordinates.map((uv) => uv[0] ?? NaN),
    xs,
  )
  const y = axisMapping(
    coordinates.map((uv) => uv[1] ?? NaN),
    ys,
  )
  return {
    boundsM: { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] },
    uvBoundsM: { x, y },
  }
}

function axisMapping(
  uvs: readonly number[],
  coordinates: readonly number[],
): readonly [number, number] {
  const low = Math.min(...uvs),
    high = Math.max(...uvs)
  if (low === high || ![...uvs, ...coordinates].every(Number.isFinite))
    throw new Error('SHADOW UV axis must have a finite span')
  const averageAt = (uv: number) => {
    const values = coordinates.filter((_, i) => uvs[i] === uv)
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  const start = averageAt(low),
    slope = (averageAt(high) - start) / (high - low)
  return [start - low * slope, start + (1 - low) * slope]
}
