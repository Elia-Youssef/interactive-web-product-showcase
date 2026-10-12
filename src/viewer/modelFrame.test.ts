import { BufferAttribute, BufferGeometry, BoxGeometry, Group, Mesh } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { measureModelFrame } from './modelFrame'

function meshOf(geometry: BufferGeometry, name: string): Mesh {
  const mesh = new Mesh(geometry)
  mesh.name = name
  return mesh
}

describe('measureModelFrame', () => {
  it('measures the bounding sphere of a subtree around the box center', () => {
    const group = new Group()
    group.add(meshOf(new BoxGeometry(2, 2, 2), 'left').translateX(-1))
    group.add(meshOf(new BoxGeometry(2, 2, 2), 'right').translateX(1))

    const frame = measureModelFrame(group)

    expect(frame.centerX).toBeCloseTo(0, 12)
    expect(frame.centerY).toBeCloseTo(0, 12)
    expect(frame.centerZ).toBeCloseTo(0, 12)
    // The two boxes span 4 units on x and 2 on the other axes; the sphere
    // around the box center reaches the x corners.
    expect(frame.radius).toBeCloseTo(Math.sqrt(2 * 2 + 1 * 1 + 1 * 1), 12)
  })

  it('counts the meshes and their triangles, indexed and not', () => {
    const indexed = new BoxGeometry(1, 1, 1) // 12 triangles via 36 indices

    const direct = new BufferGeometry()
    direct.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    const group = new Group()
    group.add(meshOf(indexed, 'indexed'))
    group.add(meshOf(direct, 'direct'))

    const frame = measureModelFrame(group)

    expect(frame.meshes).toBe(2)
    expect(frame.triangles).toBe(13)
  })

  it('ignores nodes that hold no geometry', () => {
    const group = new Group()
    group.name = 'outer'
    group.add(new Group())
    group.add(meshOf(new BoxGeometry(1, 1, 1), 'only-mesh'))

    const frame = measureModelFrame(group)

    expect(frame.meshes).toBe(1)
    expect(frame.triangles).toBe(12)
  })

  it('fails loudly on a subtree without any mesh', () => {
    const empty = new Group()
    empty.name = 'hollow'

    expect(() => measureModelFrame(empty)).toThrow(/hollow/)
  })

  it('fails loudly on a mesh without indices and without positions', () => {
    const group = new Group()
    group.add(meshOf(new BufferGeometry(), 'bare'))

    expect(() => measureModelFrame(group)).toThrow(/bare/)
  })
})
