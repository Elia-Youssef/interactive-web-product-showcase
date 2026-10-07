// The rig's exploded bounds: the parts' geometry boxes at the clip's last
// key, the shadow subtree excluded, the scene restored to the rest pose the
// parse found. The bounds the runtime plan feeds the reach rule at the
// explode's end.
import { describe, expect, it } from 'vitest'
import { AnimationClip, BoxGeometry, Mesh, Object3D, VectorKeyframeTrack } from 'three'
import { explodedBoundsOf } from './explodedBounds'
import { named } from './fixtures'

// A one-unit cube mesh object.
function cubeNode(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), undefined)
}

// The clip that lifts the given part one unit in y over one second.
function liftClip(partName: string, endY: number): AnimationClip {
  const track = new VectorKeyframeTrack(`${partName}.position`, [0, 1], [0, 0, 0, 0, endY, 0])
  return new AnimationClip('Explode', 1, [track])
}

describe('explodedBoundsOf', () => {
  it("measures the parts posed at the clip's last key", () => {
    const scene = new Object3D()
    const part = named('PART_base')
    part.add(cubeNode())
    part.position.set(0, 0, 0)
    scene.add(part)
    const parts = new Map([[part.name, part]])
    const shadow = named('SHADOW')
    scene.add(shadow)

    const bounds = explodedBoundsOf(scene, liftClip('PART_base', 3), parts, shadow)
    // The cube spans [-0.5, 0.5] around its part; lifted to y 3 the box
    // runs from 2.5 to 3.5.
    expect(bounds).toEqual({ min: [-0.5, 2.5, -0.5], max: [0.5, 3.5, 0.5] })
  })

  it('excludes the shadow subtree, wherever it sits', () => {
    const scene = new Object3D()
    const part = named('PART_base')
    part.add(cubeNode())
    scene.add(part)
    const shadow = named('SHADOW')
    shadow.add(cubeNode())
    shadow.position.set(0, 10, 0)
    scene.add(shadow)
    const parts = new Map([[part.name, part]])

    const bounds = explodedBoundsOf(scene, liftClip('PART_base', 0), parts, shadow)
    // The shadow cube at y 10 stays out: the bounds hold the part alone.
    expect(bounds).toEqual({ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] })
  })

  it('reads a part that never moves at its rest pose', () => {
    const scene = new Object3D()
    const moving = named('PART_cap')
    moving.add(cubeNode())
    const still = named('PART_base')
    still.add(cubeNode())
    still.position.set(2, 0, 0)
    scene.add(moving, still)
    const parts = new Map([
      [moving.name, moving],
      [still.name, still],
    ])

    const bounds = explodedBoundsOf(scene, liftClip('PART_cap', 1), parts, new Object3D())
    expect(bounds).toEqual({ min: [-0.5, -0.5, -0.5], max: [2.5, 1.5, 0.5] })
  })

  it('returns null when no part subtree carries geometry', () => {
    const scene = new Object3D()
    const part = named('PART_base')
    scene.add(part)
    const parts = new Map([[part.name, part]])
    expect(explodedBoundsOf(scene, liftClip('PART_base', 1), parts, new Object3D())).toBeNull()
  })

  it('leaves the scene at the rest pose it found', () => {
    const scene = new Object3D()
    const part = named('PART_base')
    part.add(cubeNode())
    scene.add(part)
    const parts = new Map([[part.name, part]])

    explodedBoundsOf(scene, liftClip('PART_base', 3), parts, new Object3D())
    expect(part.position.toArray()).toEqual([0, 0, 0])
    scene.updateMatrixWorld(true)
    const world = part.children[0]?.matrixWorld.elements
    expect(world?.slice(12, 15)).toEqual([0, 0, 0])
  })
})
