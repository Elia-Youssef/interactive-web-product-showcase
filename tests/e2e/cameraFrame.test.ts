// The runtime frame measure against three's own bounds, on real three
// scenes in Node: measureModelFrame must equal, exactly, what
// Box3.setFromObject measures over the same subtree, because the runtime
// frames the loaded scene with this function and the build-time validate
// step frames the same model with the shared frame function. The scenes
// here are the shapes where the box-transform semantics and a per-vertex
// walk differ (spheres), plus the object classes Box3 selects.
import { describe, expect, it } from 'vitest'
import {
  Box3,
  Group,
  Mesh,
  Points,
  Sphere,
  SphereGeometry,
  BufferGeometry,
  BufferAttribute,
} from 'three'
import type { Object3D } from 'three'
import { measureModelFrame } from '../../src/viewer/modelFrame'

function sphereMesh(radius: number): Mesh {
  return new Mesh(new SphereGeometry(radius, 24, 12))
}

function pointCloud(): Points {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3),
  )
  return new Points(geometry)
}

// The frame three measures itself, the runtime side of the comparison.
function threeFrame(root: Object3D): { center: [number, number, number]; radius: number } {
  const sphere = new Sphere()
  new Box3().setFromObject(root).getBoundingSphere(sphere)
  return { center: [sphere.center.x, sphere.center.y, sphere.center.z], radius: sphere.radius }
}

describe('measureModelFrame against Box3.setFromObject', () => {
  it('measures the same frame on rotated, nested and scaled spheres', () => {
    const scene = new Group()
    const nested = new Group()
    nested.position.set(0.3, -0.2, 0.1)
    const rotated = sphereMesh(1)
    rotated.position.set(0.2, 0.4, -0.1)
    rotated.rotation.set(0.7, 1.1, 0.4)
    const scaled = sphereMesh(1)
    scaled.scale.set(2, 0.5, 1.5)
    scaled.rotation.set(-0.3, 0.9, 2.0)
    nested.add(rotated)
    scene.add(nested)
    scene.add(scaled)
    scene.updateMatrixWorld(true)

    const expected = threeFrame(scene)
    const frame = measureModelFrame(scene)
    expect([frame.centerX, frame.centerY, frame.centerZ]).toEqual(expected.center)
    expect(frame.radius).toBe(expected.radius)
    expect(frame.meshes).toBe(2)
  })

  it('measures the same frame when the whole scene is transformed', () => {
    const scene = new Group()
    const sphere = sphereMesh(0.75)
    sphere.position.set(0.2, 0.4, -0.1)
    scene.add(sphere)
    scene.rotation.set(1.2, -0.4, 0.8)
    scene.scale.set(1.3, 0.8, 1.1)
    scene.updateMatrixWorld(true)

    const expected = threeFrame(scene)
    const frame = measureModelFrame(scene)
    expect([frame.centerX, frame.centerY, frame.centerZ]).toEqual(expected.center)
    expect(frame.radius).toBe(expected.radius)
  })

  it('frames a Points object exactly like Box3', () => {
    const scene = new Group()
    scene.add(pointCloud())
    scene.updateMatrixWorld(true)

    const expected = threeFrame(scene)
    const frame = measureModelFrame(scene)
    expect([frame.centerX, frame.centerY, frame.centerZ]).toEqual(expected.center)
    expect(frame.radius).toBe(expected.radius)
    expect(frame.meshes).toBe(1)
  })

  it('frames a multi-primitive group exactly like Box3', () => {
    const scene = new Group()
    const group = new Group()
    const first = sphereMesh(0.5)
    first.position.set(1, 0, 0)
    const second = sphereMesh(0.25)
    second.position.set(-1, 0.5, 0.25)
    const dots = pointCloud()
    dots.position.set(0, -1, 0)
    group.add(first, second, dots)
    group.rotation.set(0.4, 0.8, 1.6)
    scene.add(group)
    scene.updateMatrixWorld(true)

    const expected = threeFrame(scene)
    const frame = measureModelFrame(scene)
    expect([frame.centerX, frame.centerY, frame.centerZ]).toEqual(expected.center)
    expect(frame.radius).toBe(expected.radius)
    expect(frame.meshes).toBe(3)
  })

  it('throws on a subtree that holds nothing to frame', () => {
    expect(() => measureModelFrame(new Group())).toThrow('holds no meshes to frame')
  })
})
