import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Camera } from '@gltf-transform/core'
import { getBounds, type mat4, type Node as GltfNode, type vec3 } from '@gltf-transform/core'
import { createModelIO } from '../../scripts/modelIo.ts'

// The authored camera facts of a shipped product, computed in Node straight
// from the `.glb` the site ships: the model center and the home camera view
// with its orbit numbers. The camera specs derive their expectations from
// these facts, never from the viewer's own code, so a viewer regression
// cannot hide behind its own math. getBounds reads every POSITION vertex
// through the same Meshopt setup the asset pipeline reads with, already
// denormalized and transformed by its node's world matrix, which is the box
// the runtime's frame measure spans.

export type ProductCameraFacts = {
  // The center of the scene's bounding box, in the model's own space.
  readonly center: vec3
  readonly home: AuthoredHomeView
}

export type AuthoredHomeView = {
  // The camera position in stage space, where the centered model sits on
  // the origin.
  readonly position: vec3
  // The orbit target: the point on the authored view ray closest to the
  // model center.
  readonly target: vec3
  readonly fovY: number
  readonly aspect: number
  readonly near: number
  readonly far: number
  readonly azimuthDegrees: number
  readonly polarDegrees: number
  // The distance from the camera to the target, at the authored aspect.
  readonly distance: number
}

const HOME_CAMERA_NAME = 'CAM_home'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function readProductCameraFacts(slug: string): Promise<ProductCameraFacts> {
  const io = await createModelIO()
  const modelPath = path.join(ROOT, 'public', 'models', slug, 'model.glb')
  const doc = await io.read(modelPath)
  const root = doc.getRoot()

  const scene = root.listScenes()[0]
  if (scene === undefined) {
    throw new Error(`no scene in ${modelPath}`)
  }
  const bounds = getBounds(scene)
  const center: vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ]

  const homeNode = root.listNodes().find((node: GltfNode) => node.getName() === HOME_CAMERA_NAME)
  if (homeNode === undefined) {
    throw new Error(`no ${HOME_CAMERA_NAME} node in ${modelPath}`)
  }
  const camera = homeNode.getCamera()
  if (camera === null || camera.getType() !== 'perspective') {
    throw new Error(`${HOME_CAMERA_NAME} in ${modelPath} carries no perspective camera`)
  }
  return { center, home: authoredHomeViewOf(homeNode, camera, center) }
}

// The home view of one authored camera node, in stage space: the centered
// position, the orbit target the view ray's closest point to the model
// center is, the authored lens, and the orbit numbers.
function authoredHomeViewOf(homeNode: GltfNode, camera: Camera, center: vec3): AuthoredHomeView {
  const world = homeNode.getWorldMatrix()
  const position = transformPoint(world, [0, 0, 0])
  // A glTF camera looks down its local -Z, so the forward is that column
  // of the world rotation, normalized.
  const forward = normalize(transformDirection(world, [0, 0, -1]))
  const stagePosition: vec3 = [
    position[0] - center[0],
    position[1] - center[1],
    position[2] - center[2],
  ]
  // The orbit target is the point on the view ray closest to the
  // stage-space model center, the origin: the projection of the origin.
  const along = -(
    stagePosition[0] * forward[0] +
    stagePosition[1] * forward[1] +
    stagePosition[2] * forward[2]
  )
  const target: vec3 = [
    stagePosition[0] + forward[0] * along,
    stagePosition[1] + forward[1] * along,
    stagePosition[2] + forward[2] * along,
  ]
  const offset: vec3 = [
    stagePosition[0] - target[0],
    stagePosition[1] - target[1],
    stagePosition[2] - target[2],
  ]
  const distance = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1] + offset[2] * offset[2])

  return {
    position: stagePosition,
    target,
    fovY: camera.getYFov(),
    aspect: camera.getAspectRatio() ?? 1,
    near: camera.getZNear(),
    far: camera.getZFar(),
    azimuthDegrees: (Math.atan2(offset[0], offset[2]) * 180) / Math.PI,
    polarDegrees: (Math.acos(clampUnit(offset[1] / distance)) * 180) / Math.PI,
    distance,
  }
}

function transformPoint(m: mat4, v: vec3): vec3 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ]
}

function transformDirection(m: mat4, v: vec3): vec3 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ]
}

function normalize(v: vec3): vec3 {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, -1), 1)
}
