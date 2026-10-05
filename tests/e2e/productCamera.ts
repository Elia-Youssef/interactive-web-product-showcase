import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Camera, Document } from '@gltf-transform/core'
import type { Node as GltfNode, vec3 } from '@gltf-transform/core'
import {
  boundsInStageSpace,
  frameSpanOfMeshBoxes,
  inStageSpace,
  type ModelBounds,
} from '../../src/lib/camera/frame.ts'
import { viewPivotOf } from '../../src/lib/camera/pivot.ts'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from '../../src/lib/camera/view.ts'
import { CAMERA_HOME_ID, CAMERA_PREFIX } from '../../src/lib/product/contractNames.ts'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'
import type { CameraFact } from '../../scripts/modelFacts.ts'
import { anchorRestsOf, readHotspotAnchors } from '../../scripts/structure.ts'

// The authored ray of one camera: the world position, the world forward
// unit vector and the vertical fov in radians, as the camera facts carry it.
type AuthoredCameraRay = {
  readonly position: readonly [number, number, number]
  readonly forward: readonly [number, number, number]
  readonly fovY: number
}

// The authored camera facts of a shipped product, computed in Node straight
// from the `.glb` the site ships: the model frame, the home camera view and
// every close-up view, each with its orbit numbers. The frame comes from
// the one shared frame function over the document facts, the anchors' rest
// positions from the validate step's own reader, and each view's pivot
// from the one pivot rule, the same numbers and rules the build-time
// validate step checks; the projection onto each view ray and the orbit
// angles come from the unit-tested view geometry. So the specs'
// expectations stand on the shipped file and on unit-tested pure math,
// never on the viewer's runtime state, and a viewer regression cannot hide
// behind its own math.

export type ProductCameraFacts = {
  // The center of the model's bounding box, in the model's own space.
  readonly center: vec3
  // The model's bounding box in stage space, where the centered model sits
  // on the origin: the box the reach rule measures from each view target.
  readonly stageBounds: ModelBounds
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
  // view's pivot, the model center for home and the hotspot's anchor at
  // rest for a close-up.
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

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function readProductCameraFacts(slug: string): Promise<ProductCameraFacts> {
  const io = await createModelIO()
  const modelPath = path.join(ROOT, 'public', 'models', slug, 'model.glb')
  const doc = await io.read(modelPath)
  return productCameraFactsOf(doc, modelPath)
}

// The camera facts of one product document: the frame center, the home
// view and every close-up view, each the first CAM_ camera of its name. A
// CAM_ camera that is not perspective, that carries no authored aspect, or
// whose pivot the pivot rule cannot choose fails here by name: the aspect
// and the pivot are contract facts the specs derive their expectations
// from, and the build-time validate step rejects a camera without them.
export function productCameraFactsOf(doc: Document, modelPath: string): ProductCameraFacts {
  const frame = frameSpanOfMeshBoxes(readMeshBoxes(doc))
  const center: vec3 = [frame.center[0], frame.center[1], frame.center[2]]
  const anchorRests = anchorRestsOf(readHotspotAnchors(doc))
  const views = new Map<string, AuthoredView>()
  for (const { node, fact } of cameraNodesWithFacts(doc)) {
    const name = node.getName()
    const id = name.slice(CAMERA_PREFIX.length)
    if (!name.startsWith(CAMERA_PREFIX) || views.has(id)) {
      continue
    }
    const camera = node.getCamera()
    if (camera === null || camera.getType() !== 'perspective' || fact.ray === null) {
      throw new Error(`${name} in ${modelPath} carries no perspective camera`)
    }
    if (fact.aspect === null) {
      throw new Error(`${name} in ${modelPath} carries no aspect ratio`)
    }
    const choice = viewPivotOf(id, frame.center, anchorRests)
    if (choice.kind === 'broken') {
      throw new Error(`${choice.problem.message} in ${modelPath}`)
    }
    views.set(id, authoredViewOf(camera, fact.aspect, fact.ray, center, choice.pivot.point))
  }
  const home = views.get(CAMERA_HOME_ID)
  if (home === undefined) {
    throw new Error(`no ${CAMERA_PREFIX}${CAMERA_HOME_ID} node in ${modelPath}`)
  }
  views.delete(CAMERA_HOME_ID)
  return {
    center,
    stageBounds: boundsInStageSpace(frame, frame.center),
    home,
    closeUps: views,
  }
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
// the orbit target projected from the centered pivot, the authored lens,
// and the orbit numbers.
function authoredViewOf(
  camera: Camera,
  aspect: number,
  ray: AuthoredCameraRay,
  center: AuthoredCameraRay['position'],
  pivot: AuthoredCameraRay['position'],
): AuthoredView {
  const stagePosition = inStageSpace(ray.position, center)
  const orbit = orbitViewOfAuthoredCamera(
    { position: stagePosition, forward: ray.forward, fovY: ray.fovY },
    inStageSpace(pivot, center),
  )
  const angles = orbitAnglesOf(orbit.position, orbit.target)
  return {
    position: [stagePosition[0], stagePosition[1], stagePosition[2]],
    target: [orbit.target[0], orbit.target[1], orbit.target[2]],
    fovY: ray.fovY,
    aspect,
    near: camera.getZNear(),
    far: camera.getZFar(),
    azimuthDegrees: (angles.azimuth * 180) / Math.PI,
    polarDegrees: (angles.polar * 180) / Math.PI,
    distance: angles.distance,
  }
}
