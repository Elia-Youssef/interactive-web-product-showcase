import { describe, expect, it } from 'vitest'
import {
  orbitAnglesOf,
  orbitViewOfAuthoredCamera,
  pivotDepthOf,
  positionOfOrbitAngles,
  type Vec3,
} from './view'

// The conventions are the ones the camera controls use: azimuth around +Y
// from +Z, polar from +Y. The tests hold them against independently
// computed geometry, not against the implementation's own helpers.

const origin: Vec3 = [0, 0, 0]

describe('orbitViewOfAuthoredCamera', () => {
  it('projects the model center onto the view ray to place the target', () => {
    const position: Vec3 = [2, 1, 3]
    const forward: Vec3 = [0, 0, -1]
    const center: Vec3 = [4, 3, 0]

    const view = orbitViewOfAuthoredCamera({ position, forward, fovY: 0.4 }, center)

    // The closest point on the ray (2,1,3) + t*(0,0,-1) to (4,3,0) is the
    // projection along z: (2,1,0).
    expect(view.target).toEqual([2, 1, 0])
    expect(view.position).toEqual(position)
    expect(view.fovY).toBe(0.4)
  })

  it('keeps the authored direction and fov for an angled ray', () => {
    const position: Vec3 = [-0.55, 0.537, 0.786]
    const forward: Vec3 = [0.5239882928598589, -0.4067365517014401, -0.7483326422411287]
    const center: Vec3 = [0, 0, 0]

    const view = orbitViewOfAuthoredCamera({ position, forward, fovY: 0.3996 }, center)

    // The target sits on the ray, so the vector from it to the center is
    // perpendicular to the direction. The fixture carries 16 rounded
    // digits, so the perpendicularity holds to that rounding only.
    const [tx, ty, tz] = view.target
    const [fx, fy, fz] = forward
    const dot = -tx * fx - ty * fy - tz * fz
    expect(dot).toBeCloseTo(0, 6)
    expect(view.position).toEqual(position)
    expect(view.fovY).toBe(0.3996)
  })

  it('targets the center itself when the camera looks straight at it', () => {
    const position: Vec3 = [0, 0, 5]
    const forward: Vec3 = [0, 0, -1]

    const view = orbitViewOfAuthoredCamera({ position, forward, fovY: 1 }, [0, 0, 0])

    expect(view.target).toEqual([0, 0, 0])
  })

  // One function serves every pivot: the model center for home and an
  // anchor's rest for a close-up are the same projection onto the ray. The
  // depth is how far ahead of the camera the pivot projects; a negative
  // depth puts the target behind the eye, which the geometry rule rejects.
  const rows: readonly {
    readonly name: string
    readonly position: Vec3
    readonly forward: Vec3
    readonly pivot: Vec3
    readonly target: Vec3
    readonly depth: number
  }[] = [
    {
      name: 'a pivot off the ray projects onto it',
      position: [2, 1, 3],
      forward: [0, 0, -1],
      pivot: [4, 3, 0],
      target: [2, 1, 0],
      depth: 3,
    },
    {
      name: 'an anchor beside the ray and ahead of the camera',
      position: [0, 2, 4],
      forward: [0, 0, -1],
      pivot: [1.5, 0.5, 1],
      target: [0, 2, 1],
      depth: 3,
    },
    {
      name: 'an anchor below a downward ray',
      position: [1, 1, 1],
      forward: [0, -1, 0],
      pivot: [2, -2, 3],
      target: [1, -2, 1],
      depth: 3,
    },
    {
      name: 'an anchor on the ray is its own projection',
      position: [0, 0, 5],
      forward: [0, 0, -1],
      pivot: [0, 0, 1],
      target: [0, 0, 1],
      depth: 4,
    },
    {
      name: 'an anchor behind the camera projects behind the eye',
      position: [0, 0, 5],
      forward: [0, 0, -1],
      pivot: [2, 3, 9],
      target: [0, 0, 9],
      depth: -4,
    },
    {
      name: 'an anchor at a right angle to the ray projects onto the camera',
      position: [1, 2, 3],
      forward: [0, 1, 0],
      pivot: [4, 2, 8],
      target: [1, 2, 3],
      depth: 0,
    },
  ]

  it.each(rows)('$name', ({ position, forward, pivot, target, depth }) => {
    const ray = { position, forward, fovY: 0.5 }
    expect(orbitViewOfAuthoredCamera(ray, pivot).target).toEqual(target)
    expect(pivotDepthOf(ray, pivot)).toBe(depth)
  })
})

describe('orbitAnglesOf and positionOfOrbitAngles', () => {
  it('reads azimuth 0 and polar 90 degrees in front of the target on +Z', () => {
    const angles = orbitAnglesOf([0, 0, 2], origin)

    expect(angles.azimuth).toBeCloseTo(0, 15)
    expect(angles.polar).toBeCloseTo(Math.PI / 2, 15)
    expect(angles.distance).toBe(2)
  })

  it('reads azimuth 90 degrees in front of the target on +X', () => {
    const angles = orbitAnglesOf([3, 0, 0], origin)

    expect(angles.azimuth).toBeCloseTo(Math.PI / 2, 15)
    expect(angles.polar).toBeCloseTo(Math.PI / 2, 15)
  })

  it('reads polar 0 straight above the target', () => {
    const angles = orbitAnglesOf([0, 4, 0], origin)

    expect(angles.polar).toBeCloseTo(0, 15)
  })

  it('round-trips a position through angles and back', () => {
    const target: Vec3 = [1, -2, 0.5]
    const position: Vec3 = [-3, 1.5, 2]

    const angles = orbitAnglesOf(position, target)
    const readBack = positionOfOrbitAngles(angles.azimuth, angles.polar, angles.distance, target)

    // The atan2, acos, sin and cos round trip carries float error of its
    // own, so the point returns to itself within that error only.
    expect(readBack[0]).toBeCloseTo(position[0], 12)
    expect(readBack[1]).toBeCloseTo(position[1], 12)
    expect(readBack[2]).toBeCloseTo(position[2], 12)
  })

  it('keeps a negative azimuth as the negative angle it is', () => {
    // A quarter turn clockwise from +Z, seen from above, sits on -X.
    const angles = orbitAnglesOf([-2, 0, 0], origin)

    expect(angles.azimuth).toBeCloseTo(-Math.PI / 2, 15)
  })
})
