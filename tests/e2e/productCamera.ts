import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Camera, Document } from '@gltf-transform/core'
import type { Node as GltfNode, vec3 } from '@gltf-transform/core'
import { frameSpanOfMeshBoxes } from '../../src/lib/camera/frame.ts'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'
import type { CameraFact } from '../../scripts/modelFacts.ts'

// The authored ray of one camera: the world position, the world forward
// unit vector and the vertical fov in radians, as the camera facts carry it.
type AuthoredCameraRay = {
  readonly position: readonly [number, number, number]
  readonly forward: readonly [number, number, number]
  readonly fovY: number
}

// The authored camera facts of a shipped product, computed in Node straight
// from the `.glb` the site ships: the model frame, the home camera view and
// every close-up view, each with its orbit numbers. The frame center comes
// from the one shared frame function over the document facts, the same
// numbers the build-time validate step checks; the projection onto each
// view ray and the orbit angles are computed here, in this module. So the
// specs' expectations stand on the shipped file and on unit-tested pure
// math, never on the viewer's runtime state, and a viewer regression cannot
// hide behind its own math.

export type ProductCameraFacts = {
  // The center of the model's bounding box, in the model's own space.
  readonly center: vec3
  readonly home: AuthoredView
  // Every other CAM_ view the model carries, keyed by the id after the
  // CAM_ prefix: a hotspot's close-up under the hotspot's id. A hotspot
  // without a close-up has no entry.
  readonly closeUps: ReadonlyMap<string, AuthoredView>
}

export type AuthoredView = {
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

const CAMERA_NODE_PREFIX = 'CAM_'
const HOME_VIEW_ID = 'home'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function readProductCameraFacts(slug: string): Promise<ProductCameraFacts> {
  const io = await createModelIO()
  const modelPath = path.join(ROOT, 'public', 'models', slug, 'model.glb')
  const doc = await io.read(modelPath)
  return productCameraFactsOf(doc, modelPath)
}

// The camera facts of one product document: the frame center, the home
// view and every close-up view, each the first CAM_ camera of its name. A
// CAM_ camera that is not perspective, or that carries no authored aspect,
// fails here by name: the aspect is a contract fact the specs derive their
// scaling from, and the build-time validate step rejects a camera without
// one.
export function productCameraFactsOf(doc: Document, modelPath: string): ProductCameraFacts {
  const frame = frameSpanOfMeshBoxes(readMeshBoxes(doc))
  const center: vec3 = [frame.center[0], frame.center[1], frame.center[2]]
  const views = new Map<string, AuthoredView>()
  for (const { node, fact } of cameraNodesWithFacts(doc)) {
    const name = node.getName()
    const id = name.slice(CAMERA_NODE_PREFIX.length)
    if (!name.startsWith(CAMERA_NODE_PREFIX) || views.has(id)) {
      continue
    }
    const camera = node.getCamera()
    if (camera === null || camera.getType() !== 'perspective' || fact.ray === null) {
      throw new Error(`${name} in ${modelPath} carries no perspective camera`)
    }
    if (fact.aspect === null) {
      throw new Error(`${name} in ${modelPath} carries no aspect ratio`)
    }
    views.set(id, authoredViewOf(camera, fact.aspect, fact.ray, frame.center))
  }
  const home = views.get(HOME_VIEW_ID)
  if (home === undefined) {
    throw new Error(`no ${CAMERA_NODE_PREFIX}${HOME_VIEW_ID} node in ${modelPath}`)
  }
  views.delete(HOME_VIEW_ID)
  return { center, home, closeUps: views }
}

// Every camera node of the document beside its camera fact. The facts are
// one per camera node in the document's node order, so the two lists pair
// up by position; the names are checked, so a reordered read fails loudly.
function cameraNodesWithFacts(doc: Document): { node: GltfNode; fact: CameraFact }[] {
  const nodes = doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getCamera() !== null)
  const facts = readCameraFacts(doc)
  return nodes.map((node, index) => {
    const fact = facts[index]
    if (fact === undefined || fact.name !== node.getName()) {
      throw new Error('internal error: the camera facts do not pair with the camera nodes')
    }
    return { node, fact }
  })
}

// The view of one authored camera, in stage space: the centered position,
// the orbit target the view ray's closest point to the model center is,
// the authored lens, and the orbit numbers.
function authoredViewOf(
  camera: Camera,
  aspect: number,
  ray: AuthoredCameraRay,
  center: AuthoredCameraRay['position'],
): AuthoredView {
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
