import { BoxGeometry, Mesh, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { aimRay } from './aimRay'

describe('aimRay', () => {
  it('sets the origin, a unit direction and far at the length, and returns the length', () => {
    const raycaster = new Raycaster()
    const length = aimRay(raycaster, new Vector3(1, 2, 3), new Vector3(2, 1, 3))

    expect(length).toBeCloseTo(Math.SQRT2, 12)
    expect(raycaster.far).toBeCloseTo(Math.SQRT2, 12)
    expect(raycaster.ray.origin.x).toBe(1)
    expect(raycaster.ray.origin.y).toBe(2)
    expect(raycaster.ray.origin.z).toBe(3)
    // The direction is the unit vector toward the target, the one shape the
    // raycaster's sphere pretest reads distances from.
    expect(raycaster.ray.direction.length()).toBeCloseTo(1, 12)
    expect(raycaster.ray.direction.x).toBeCloseTo(Math.SQRT1_2, 12)
    expect(raycaster.ray.direction.y).toBeCloseTo(-Math.SQRT1_2, 12)
    expect(raycaster.ray.direction.z).toBeCloseTo(0, 12)
  })

  it('fails loudly when the target sits on the origin: a zero aim has no direction', () => {
    const raycaster = new Raycaster()
    expect(() => aimRay(raycaster, new Vector3(1, 2, 3), new Vector3(1, 2, 3))).toThrow(/zero aim/)
  })

  it('hits a plate between the camera and a sub-1 m target: the pretest reads the unit direction', () => {
    // The camera at z = 5 and the target 0.3 m ahead, with the plate's
    // entry face 0.145 m out. A non-unit direction of length 0.3 overestimates
    // the perpendicular distance in the bounding-sphere pretest and drops
    // this hit before any triangle test.
    const raycaster = new Raycaster()
    const length = aimRay(raycaster, new Vector3(0, 0, 5), new Vector3(0, 0, 4.7))
    expect(length).toBeCloseTo(0.3, 12)

    const plate = new Mesh(new BoxGeometry(0.1, 0.1, 0.01))
    plate.position.set(0, 0, 4.85)
    plate.updateMatrixWorld()

    const hits = raycaster.intersectObject(plate, false)
    // Both hits land on the plate's +Z face: the axis aim rides the two
    // triangles' shared diagonal, and a ray a centimeter off it returns one
    // hit. The count is triangle bookkeeping; the nearest distance is the
    // contract, the entry face the ray meets first, the one the visibility
    // rule reads.
    expect(
      hits.length,
      'the plate between the camera and the target must be hit',
    ).toBeGreaterThanOrEqual(1)
    expect(hits[0]?.distance, 'the nearest hit is the plate entry face').toBeCloseTo(0.145, 9)
  })
})
