import { BufferAttribute, BufferGeometry, Mesh, Object3D, PerspectiveCamera } from 'three'
import type { Camera, Document, Node as GltfNode, Primitive } from '@gltf-transform/core'

// The three scene tree a product document loads into, built the way
// three's GLTFLoader builds it: one node object per glTF node carrying the
// node's translation, rotation and scale, one mesh per primitive whose
// position attribute is the decoded accessor array with its normalized
// flag, and one perspective camera per perspective camera node, with the
// loader's own silent aspect default. This is the shape the runtime's
// frame measure and camera reads run over, so the agreement proofs in this
// folder exercise the runtime code on the shipped model's real geometry
// and transforms.

export function buildThreeTree(doc: Document): Object3D {
  const scene = doc.getRoot().listScenes()[0]
  if (scene === undefined) {
    throw new Error('the document holds no scene to build')
  }
  const root = new Object3D()
  for (const node of scene.listChildren()) {
    root.add(objectOf(node))
  }
  return root
}

function objectOf(node: GltfNode): Object3D {
  const [tx, ty, tz] = node.getTranslation()
  const [qx, qy, qz, qw] = node.getRotation()
  const [sx, sy, sz] = node.getScale()
  const object = new Object3D()
  object.name = node.getName()
  object.position.set(tx, ty, tz)
  object.quaternion.set(qx, qy, qz, qw)
  object.scale.set(sx, sy, sz)
  const mesh = node.getMesh()
  if (mesh !== null) {
    for (const primitive of mesh.listPrimitives()) {
      object.add(primitiveObject(primitive))
    }
  }
  const camera = node.getCamera()
  if (camera !== null && camera.getType() === 'perspective') {
    object.add(perspectiveCameraOf(camera))
  }
  for (const child of node.listChildren()) {
    object.add(objectOf(child))
  }
  return object
}

function primitiveObject(primitive: Primitive): Mesh {
  const geometry = new BufferGeometry()
  const position = primitive.getAttribute('POSITION')
  if (position === null) {
    throw new Error('the document holds a primitive without positions')
  }
  const array = position.getArray()
  if (!(array instanceof Float32Array || array instanceof Int16Array)) {
    throw new Error(
      'the document holds positions in a component type the proof tree does not build',
    )
  }
  geometry.setAttribute('position', new BufferAttribute(array, 3, position.getNormalized()))
  return new Mesh(geometry)
}

function perspectiveCameraOf(camera: Camera): PerspectiveCamera {
  // The loader converts the authored vertical fov to the degrees three's
  // camera keeps, and defaults a missing aspect to 1: the loader's own
  // default, outside our code, which the build-time validate step rejects.
  const aspect = camera.getAspectRatio() ?? 1
  return new PerspectiveCamera(
    camera.getYFov() * (180 / Math.PI),
    aspect,
    camera.getZNear(),
    camera.getZFar(),
  )
}
