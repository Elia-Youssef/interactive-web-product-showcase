import { Texture } from 'three/webgpu'
import type {
  BufferAttribute,
  BufferGeometry,
  InterleavedBufferAttribute,
  Material,
  Object3D,
} from 'three/webgpu'
import { carriesGeometry } from '../modelFrame'

// The bytes a loaded model holds in the page itself, by kind: the distinct
// array buffers its geometry attributes sit in, and those its texture data
// sit in, each buffer counted once however many attributes, views or
// materials share it. The renderer keeps both in the page for as long as
// the model lives, on both backends. Images the browser decodes on its own
// (an image bitmap) hold no array buffer and count nothing here. Measured
// once per load.
//
// The two kinds are kept apart because they are let go differently. Nothing
// outside the model references its geometry, so releasing the model frees
// at least the geometry bytes. Its texture data can stay reachable a while
// longer: three's node materials share one reference node per material
// property across every material (src/nodes/accessors/MaterialNode.js,
// _propertyCache), and that node keeps the last material it read, with its
// textures, until a later render reads another material for the property.
// That holds one model's worth at most and never grows, but it means a
// release frees the texture bytes only once another model has rendered.
export type HeldModelBytes = {
  readonly geometry: number
  readonly textures: number
}

export function measureHeldBytes(root: Object3D): HeldModelBytes {
  const geometry = new Set<ArrayBufferLike>()
  const textures = new Set<ArrayBufferLike>()
  root.traverse((node) => {
    if (!carriesGeometry(node)) {
      return
    }
    for (const array of geometryArrays(node.geometry)) {
      geometry.add(array.buffer)
    }
    for (const material of materialsOf(node.material)) {
      for (const array of materialTextureArrays(material)) {
        textures.add(array.buffer)
      }
    }
  })
  return { geometry: bytesOf(geometry), textures: bytesOf(textures, geometry) }
}

// The bytes of the buffers, leaving out any already counted in another kind.
function bytesOf(
  buffers: ReadonlySet<ArrayBufferLike>,
  counted: ReadonlySet<ArrayBufferLike> = new Set(),
): number {
  let bytes = 0
  for (const buffer of buffers) {
    if (!counted.has(buffer)) {
      bytes += buffer.byteLength
    }
  }
  return bytes
}

// Every array a geometry holds: its attributes, its index and its morph
// targets, an interleaved attribute through its shared buffer.
function geometryArrays(geometry: BufferGeometry): ArrayBufferView[] {
  const attributes: (BufferAttribute | InterleavedBufferAttribute)[] = [
    ...Object.values(geometry.attributes),
    ...Object.values(geometry.morphAttributes).flat(),
  ]
  if (geometry.index !== null) {
    attributes.push(geometry.index)
  }
  return attributes.map((attribute) =>
    'isInterleavedBufferAttribute' in attribute ? attribute.data.array : attribute.array,
  )
}

function materialsOf(material: Material | Material[]): Material[] {
  return Array.isArray(material) ? material : [material]
}

// The data arrays of every texture the material holds in its own slots: the
// mip levels of a compressed texture, and the image data of a data texture.
function materialTextureArrays(material: Material): ArrayBufferView[] {
  return Object.values(material)
    .filter((value): value is Texture => value instanceof Texture)
    .flatMap((texture) => [texture.image, ...mipmapsOf(texture)].flatMap(dataOf))
}

function mipmapsOf(texture: Texture): unknown[] {
  const mipmaps: unknown = texture.mipmaps
  return Array.isArray(mipmaps) ? mipmaps : []
}

function dataOf(level: unknown): ArrayBufferView[] {
  if (typeof level !== 'object' || level === null) {
    return []
  }
  const data: unknown = Reflect.get(level, 'data')
  return ArrayBuffer.isView(data) ? [data] : []
}
