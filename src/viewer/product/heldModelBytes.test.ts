import { describe, expect, it } from 'vitest'
import {
  BufferAttribute,
  BufferGeometry,
  CompressedTexture,
  DataTexture,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Points,
  Texture,
} from 'three/webgpu'
import { measureHeldBytes } from './heldModelBytes'

// The bytes a model holds in the page, by kind: every distinct array buffer
// behind its attributes, and behind its texture data, once.

function meshOf(geometry: BufferGeometry, material = new MeshStandardMaterial()): Mesh {
  return new Mesh(geometry, material)
}

describe('measureHeldBytes', () => {
  it('counts every attribute, the index and the morph targets of every mesh in the tree', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    geometry.setIndex(new BufferAttribute(new Uint16Array(3), 1))
    geometry.morphAttributes.position = [new BufferAttribute(new Float32Array(9), 3)]
    const points = new BufferGeometry()
    points.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))
    const root = new Group().add(new Group().add(meshOf(geometry)), new Points(points))

    expect(measureHeldBytes(root)).toEqual({ geometry: 36 + 6 + 36 + 12, textures: 0 })
  })

  it('counts a buffer shared by views, interleaved attributes and meshes once, whole', () => {
    const shared = new ArrayBuffer(64)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(shared, 0, 6), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(shared, 24, 6), 3))
    const interleaved = new InterleavedBuffer(new Float32Array(12), 6)
    geometry.setAttribute('uv', new InterleavedBufferAttribute(interleaved, 2, 0))
    geometry.setAttribute('uv1', new InterleavedBufferAttribute(interleaved, 2, 2))
    const root = new Group().add(meshOf(geometry), meshOf(geometry))

    expect(measureHeldBytes(root)).toEqual({ geometry: 64 + 48, textures: 0 })
  })

  it('counts the mip levels of a compressed texture and the data of a data texture, once per texture', () => {
    const compressed = new CompressedTexture(
      [
        { data: new Uint8Array(64), width: 4, height: 4 },
        { data: new Uint8Array(16), width: 2, height: 2 },
      ],
      4,
      4,
    )
    const data = new DataTexture(new Uint8Array(32), 2, 4)
    const first = new MeshStandardMaterial({ map: compressed, normalMap: data })
    const second = new MeshStandardMaterial({ map: compressed })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))
    const root = new Group().add(meshOf(geometry, first), new Mesh(geometry, [second, first]))

    expect(measureHeldBytes(root)).toEqual({ geometry: 12, textures: 64 + 16 + 32 })
  })

  it('counts nothing for a texture whose image holds no array buffer', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))
    const texture = new Texture({ width: 8, height: 8 })
    const root = meshOf(geometry, new MeshStandardMaterial({ map: texture }))

    expect(measureHeldBytes(root)).toEqual({ geometry: 12, textures: 0 })
  })
})
