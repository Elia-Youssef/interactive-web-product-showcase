import { AnimationClip, Group, Object3D, type PerspectiveCamera } from 'three'
import type { CameraLimitProblem } from '@lib/camera/limits'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import type { CameraPlan, CameraPlanBuild } from './productPlan'

// The inputs the camera plan builder's tests build against: the parsed
// manifest with the camera block a case overrides, a rig of authored
// cameras, the measured frames, and the centered tree the cameras mount in;
// and the reads of the build outcome a case expects.

// The parsed manifest the plan builds against, with the camera block each
// case overrides, so the builder reads the real schema output.
export function manifestWith(camera: { minDistance?: number; maxDistance?: number } | undefined) {
  return parseProduct({ ...sampleOneManifest, camera }, 'sample-one.test')
}

// A rig for the builder: only its cameras enter the plan, so the rest holds
// minimal stand-ins.
export function rigWith(cameras: readonly PerspectiveCamera[]): ProductRig {
  return {
    parts: new Map(),
    hotspots: [],
    cameras: new Map(cameras.map((camera) => [camera.name.slice('CAM_'.length), camera])),
    shadow: new Object3D(),
    clip: new AnimationClip('Explode', 1, []),
    variants: [],
  }
}

// A measured frame whose center rides 0.1 above the floor, which the
// centering group offsets.
export const raisedFrame: ModelFrame = {
  centerX: 0,
  centerY: 0.1,
  centerZ: 0,
  radius: 0.4,
  meshes: 1,
  triangles: 12,
}

// A centered frame: no centering offset, a small radius, so the views orbit
// the origin.
export const centeredFrame: ModelFrame = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  radius: 0.05,
  meshes: 1,
  triangles: 12,
}

// Mounts the cameras under a centering group offset, the way the loaded
// product's tree is centered on the origin.
export function mountedTree(
  cameras: readonly PerspectiveCamera[],
  offset: ModelFrame = raisedFrame,
): Group {
  const group = new Group()
  group.position.set(-offset.centerX, -offset.centerY, -offset.centerZ)
  const scene = new Object3D()
  for (const camera of cameras) {
    scene.add(camera)
  }
  group.add(scene)
  return group
}

// The plan of a build the case expects to succeed; a broken build fails
// the case with the problems it reported.
export function planned(build: CameraPlanBuild): CameraPlan {
  if (build.kind === 'broken') {
    throw new Error(`the plan must build, it broke with: ${JSON.stringify(build.problems)}`)
  }
  return build.plan
}

// The problems of a build the case expects to break; a planned build fails
// the case.
export function brokenProblems(build: CameraPlanBuild): readonly CameraLimitProblem[] {
  if (build.kind === 'planned') {
    throw new Error('the broken camera data must be reported as a broken build')
  }
  return build.problems
}

// The problem messages of a build the case expects to break, one per line.
export function brokenMessages(build: CameraPlanBuild): string {
  return brokenProblems(build)
    .map((problem) => problem.message)
    .join('\n')
}
