// The model facts the camera and geometry contracts read from a product
// document: one mesh box per primitive, one camera fact per camera node,
// and the geometry shape counts, as plain data. These are the facts the
// runtime measures from the loaded scene graph, read here the way
// three's GLTFLoader reads them, so the build-time validate step can run
// the same rules over the same numbers. Only facts leave the document: it
// is never carried past the model step.

import type { Accessor, Document, Node } from '@gltf-transform/core'
import { isMat4, transformPointOf } from '../src/lib/camera/frame.ts'
import type { Mat4, MeshBox, Vec3 } from '../src/lib/camera/frame.ts'
import type { AuthoredCameraRay } from '../src/lib/camera/view.ts'

// The triangle-mode draw mode of a glTF primitive; every other mode
// (points, lines, strips, fans) is a class the site does not present.
const TRIANGLE_MODE = 4

// The instancing extension whose meshes the frame contract cannot read.
const GPU_INSTANCING_EXTENSION = 'EXT_mesh_gpu_instancing'

// The geometry shape counts the model contract's rules read: which
// primitive classes the document holds, and whether the scene graph is one
// scene holding every node.
export type GeometryFacts = {
  readonly primitives: number
  readonly primitivesNotTriangles: number
  readonly primitivesWithoutPosition: number
  readonly primitivesWithMorphTargets: number
  readonly skins: number
  readonly gpuInstancing: boolean
  readonly scenes: number
  readonly nodeNamesOutsideScene: readonly string[]
}

// One camera node's facts: its name, its authored camera ray (the world
// position, the world forward unit vector and the vertical fov in radians
// the runtime reads off the loaded camera), and the authored aspect ratio.
// A camera that is not perspective carries no ray and no aspect: the site
// presents perspective views only.
export type CameraFact = {
  readonly name: string
  readonly ray: AuthoredCameraRay | null
  readonly aspect: number | null
}

// One box per primitive, the mesh's local position bounds and the world
// matrix they sit in, exactly as three's loader computes the primitive
// bounds it stores on the geometry: the accessor's raw min and max (the
// values in the file), times the component's normalized scale when the
// accessor is normalized (the loader multiplies with the reciprocal
// constant and never clamps), widened by the morph targets' absolute
// displacement the loader widens them by. A primitive without positions
// contributes nothing: the loader leaves such a geometry's box unset and
// three's union skips the empty box it then computes.
export function readMeshBoxes(doc: Document): MeshBox[] {
  const meshBoxes: MeshBox[] = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) {
      continue
    }
    const matrix = worldMatrixOf(node)
    for (const primitive of mesh.listPrimitives()) {
      const box = primitiveBox(primitive)
      if (box !== null) {
        meshBoxes.push({ ...box, matrix })
      }
    }
  }
  return meshBoxes
}

// One fact per camera node, in the document's node order.
export function readCameraFacts(doc: Document): CameraFact[] {
  const facts: CameraFact[] = []
  for (const node of doc.getRoot().listNodes()) {
    const camera = node.getCamera()
    if (camera === null) {
      continue
    }
    const world = worldMatrixOf(node)
    if (camera.getType() !== 'perspective') {
      facts.push({ name: node.getName(), ray: null, aspect: null })
      continue
    }
    facts.push({
      name: node.getName(),
      ray: {
        position: transformPointOf(world, [0, 0, 0]),
        forward: normalize(transformDirection(world, [0, 0, -1])),
        fovY: camera.getYFov(),
      },
      aspect: camera.getAspectRatio(),
    })
  }
  return facts
}

// The geometry shape counts of the document.
export function readGeometryFacts(doc: Document): GeometryFacts {
  const root = doc.getRoot()
  let primitives = 0
  let primitivesNotTriangles = 0
  let primitivesWithoutPosition = 0
  let primitivesWithMorphTargets = 0
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives += 1
      if (primitive.getMode() !== TRIANGLE_MODE) {
        primitivesNotTriangles += 1
      }
      if (primitive.getAttribute('POSITION') === null) {
        primitivesWithoutPosition += 1
      }
      if (primitive.listTargets().length > 0) {
        primitivesWithMorphTargets += 1
      }
    }
  }
  const sceneNodes = new Set<Node>()
  for (const scene of root.listScenes()) {
    scene.traverse((node) => {
      sceneNodes.add(node)
    })
  }
  return {
    primitives,
    primitivesNotTriangles,
    primitivesWithoutPosition,
    primitivesWithMorphTargets,
    skins: root.listSkins().length,
    gpuInstancing: root
      .listExtensionsUsed()
      .some((extension) => extension.extensionName === GPU_INSTANCING_EXTENSION),
    scenes: root.listScenes().length,
    nodeNamesOutsideScene: root
      .listNodes()
      .filter((node) => !sceneNodes.has(node))
      .map((node) => node.getName() || 'unnamed'),
  }
}

// The local position bounds of one primitive, widened by its morph
// targets, in the loader's own order: the accessor bounds with the
// normalized scale multiplied in, then each target's largest absolute
// displacement per component added to the box on both sides.
function primitiveBox(primitive: {
  getAttribute: (semantic: string) => Accessor | null
  listTargets: () => readonly MorphTarget[]
}): { min: Vec3; max: Vec3 } | null {
  const position = primitive.getAttribute('POSITION')
  if (position === null) {
    return null
  }
  const scale = normalizedScaleOf(position)
  const bounds = rawBoundsOf(position)
  const min: [number, number, number] = [
    bounds.min[0] * scale,
    bounds.min[1] * scale,
    bounds.min[2] * scale,
  ]
  const max: [number, number, number] = [
    bounds.max[0] * scale,
    bounds.max[1] * scale,
    bounds.max[2] * scale,
  ]
  for (const target of primitive.listTargets()) {
    const displacement = target.getAttribute('POSITION')
    if (displacement === null) {
      continue
    }
    const widen = widenedBy(rawBoundsOf(displacement), normalizedScaleOf(displacement))
    min[0] -= widen[0]
    min[1] -= widen[1]
    min[2] -= widen[2]
    max[0] += widen[0]
    max[1] += widen[1]
    max[2] += widen[2]
  }
  return { min: [...min], max: [...max] }
}

function rawBoundsOf(accessor: Accessor): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [0, 0, 0]
  const max: [number, number, number] = [0, 0, 0]
  accessor.getMin(min)
  accessor.getMax(max)
  return { min, max }
}

// The largest absolute component of the bounds per axis, times the scale:
// the displacement the loader widens a primitive box by for one morph
// target (the target weights reach -1 and 1, so both signs displace).
function widenedBy(bounds: { min: Vec3; max: Vec3 }, scale: number): Vec3 {
  return [
    Math.max(Math.abs(bounds.min[0]), Math.abs(bounds.max[0])) * scale,
    Math.max(Math.abs(bounds.min[1]), Math.abs(bounds.max[1])) * scale,
    Math.max(Math.abs(bounds.min[2]), Math.abs(bounds.max[2])) * scale,
  ]
}

type MorphTarget = {
  getAttribute: (semantic: string) => Accessor | null
}

// The normalized component scale, the constants of the loader's own table:
// the reciprocals it multiplies a normalized accessor's values with. A
// normalized accessor of any other component type is refused, the way the
// loader refuses it.
function normalizedScaleOf(accessor: Accessor): number {
  if (!accessor.getNormalized()) {
    return 1
  }
  switch (accessor.getComponentType()) {
    case 5120:
      return 1 / 127
    case 5121:
      return 1 / 255
    case 5122:
      return 1 / 32767
    case 5123:
      return 1 / 65535
    default:
      throw new Error('unsupported normalized accessor component type')
  }
}

function worldMatrixOf(node: { getWorldMatrix(): number[] }): Mat4 {
  const matrix = node.getWorldMatrix()
  if (!isMat4(matrix)) {
    throw new Error('internal error: a world matrix carries fewer than 16 elements')
  }
  return matrix
}

// A glTF camera looks down its local -Z, so the forward is that column of
// the world matrix, negated, then normalized the way three's camera
// direction read normalizes it: multiplied with the reciprocal of the
// length.
function transformDirection(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [
    x * m[0] + y * m[4] + z * m[8],
    x * m[1] + y * m[5] + z * m[9],
    x * m[2] + y * m[6] + z * m[10],
  ]
}

function normalize([x, y, z]: Vec3): Vec3 {
  const reciprocal = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
  return [x * reciprocal, y * reciprocal, z * reciprocal]
}
