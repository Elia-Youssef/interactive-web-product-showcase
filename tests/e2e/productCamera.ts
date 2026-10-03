import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Camera, Document } from '@gltf-transform/core'
import type { Node as GltfNode, vec3 } from '@gltf-transform/core'
import { frameSpanOfMeshBoxes } from '../../src/lib/camera/frame.ts'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'

// The authored ray of one camera: the world position, the world forward
// unit vector and the vertical fov in radians, as the camera facts carry it.
type AuthoredCameraRay = {
  readonly position: readonly [number, number, number]
  readonly forward: readonly [number, number, number]
  readonly fovY: number
}

// The authored camera facts of a shipped product, computed in Node straight
// from the `.glb` the site ships: the model frame and the home camera view
// with its orbit numbers. The frame center comes from the one shared frame
// function over the document facts, the same numbers the build-time
// validate step checks; the projection onto the view ray and the orbit
// angles are computed here, in this module, the way the base computed them.
// So the specs' expectations stand on the shipped file and on unit-tested
// pure math, never on the viewer's runtime state, and a viewer regression
// cannot hide behind its own math.

export type ProductCameraFacts = {
  // The center of the model's bounding box, in the model's own space.
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
  return productCameraFactsOf(doc, modelPath)
}

// The camera facts of one product document: the frame center and the home
// view. A home camera with no authored aspect fails here by name: the
// aspect is a contract fact the specs derive their scaling from, and the
// build-time validate step rejects a camera without one.
export function productCameraFactsOf(doc: Document, modelPath: string): ProductCameraFacts {
  const frame = frameSpanOfMeshBoxes(readMeshBoxes(doc))
  const center: vec3 = [frame.center[0], frame.center[1], frame.center[2]]
  const homeNode = doc
    .getRoot()
    .listNodes()
    .find((node: GltfNode) => node.getName() === HOME_CAMERA_NAME)
  if (homeNode === undefined) {
    throw new Error(`no ${HOME_CAMERA_NAME} node in ${modelPath}`)
  }
  const camera = homeNode.getCamera()
  if (camera === null || camera.getType() !== 'perspective') {
    throw new Error(`${HOME_CAMERA_NAME} in ${modelPath} carries no perspective camera`)
  }
  const aspect = camera.getAspectRatio()
  if (aspect === null) {
    throw new Error(`${HOME_CAMERA_NAME} in ${modelPath} carries no aspect ratio`)
  }
  const homeFact = readCameraFacts(doc).find((fact) => fact.name === HOME_CAMERA_NAME)
  if (homeFact === undefined || homeFact.ray === null) {
    throw new Error(`${HOME_CAMERA_NAME} in ${modelPath} carries no authored camera ray`)
  }
  return { center, home: authoredHomeViewOf(camera, aspect, homeFact.ray, frame.center) }
}

// The home view of the authored camera, in stage space: the centered
// position, the orbit target the view ray's closest point to the model
// center is, the authored lens, and the orbit numbers.
function authoredHomeViewOf(
  camera: Camera,
  aspect: number,
  ray: AuthoredCameraRay,
  center: AuthoredCameraRay['position'],
): AuthoredHomeView {
  const stagePosition: vec3 = [
    ray.position[0] - center[0],
    ray.position[1] - center[1],
    ray.position[2] - center[2],
  ]
  // The orbit target is the point on the view ray closest to the stage
  // origin: the projection of the origin onto the ray, computed here so the
  // specs' expectations do not stand on the viewer's own math.
  const along = -(
    stagePosition[0] * ray.forward[0] +
    stagePosition[1] * ray.forward[1] +
    stagePosition[2] * ray.forward[2]
  )
  const target: vec3 = [
    stagePosition[0] + ray.forward[0] * along,
    stagePosition[1] + ray.forward[1] * along,
    stagePosition[2] + ray.forward[2] * along,
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
    fovY: ray.fovY,
    aspect,
    near: camera.getZNear(),
    far: camera.getZFar(),
    azimuthDegrees: (Math.atan2(offset[0], offset[2]) * 180) / Math.PI,
    polarDegrees: (Math.acos(clampUnit(offset[1] / distance)) * 180) / Math.PI,
    distance,
  }
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, -1), 1)
}
