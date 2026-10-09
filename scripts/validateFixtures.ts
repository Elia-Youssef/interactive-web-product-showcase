// The in-memory contract document for the validate suites: the shapes the
// Blender contract names (parts, hotspots, cameras, variants, the explode
// clip), built with @gltf-transform/core so no test needs Blender or
// KTX-Software. Every option bends one rule, which is how a suite asserts
// the exact violation.
import { Document, type Node as GltfNode } from '@gltf-transform/core'
import {
  EXTMeshoptCompression,
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  type MappingList,
} from '@gltf-transform/extensions'
import { authoredCameraAspect } from '../src/lib/camera/config.ts'
import { cameraContractProblems } from '../src/lib/camera/contract.ts'
import { viewPivotOf } from '../src/lib/camera/pivot.ts'
import { pngBytes } from './texture.fixtures.ts'
import type { CameraContract } from './manifestIo.ts'

// The camera contract the check suites run, as the real module export: one
// fixture, imported by every suite that calls the camera check.
export const cameraContract: CameraContract = { cameraContractProblems, viewPivotOf }

// Where the fixture hotspots hang. The two kinds are distinct tags, not one
// string, so parenting to a node literally named 'scene' stays expressible
// and can never be misread as the scene root.
export type HotspotParent =
  { readonly kind: 'node'; readonly name: string } | { readonly kind: 'scene' }

// The pose every fixture camera carries. A camera looks down its local -Z,
// so an identity rotation from the given position looks straight at the
// fixture model's center; the rotation quaternion re-aims it. The aspect
// plants the camera contract's cases: the authored ratio to pass, any other
// ratio to fail it, and null for a camera with none.
export type CameraPose = {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number, number]
  readonly fovYDegrees: number
  readonly aspect: number | null
}

// The pose the fixture contract passes on: the model framed from the front,
// at the authored aspect, with the home distance clearing the fixture
// model's radius.
export const PASSING_CAMERA_POSE: CameraPose = {
  position: [1, 1, 4],
  fovYDegrees: 30,
  aspect: authoredCameraAspect,
}

export type DocumentOptions = {
  // HS_ node names, parented to the named node (or the scene root).
  hotspotNames?: string[]
  hotspotParent?: HotspotParent
  cameraNames?: string[]
  cameraPose?: CameraPose
  variantNames?: string[]
  animationNames?: string[]
  // Whether the document carries the Meshopt extension mark.
  meshopt?: boolean
}

export function vec3Accessor(
  doc: Document,
  values: number[],
): ReturnType<Document['createAccessor']> {
  const accessor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(values))
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function scalarAccessor(doc: Document, values: number[]): ReturnType<Document['createAccessor']> {
  const accessor = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(values))
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function quadIndices(doc: Document): ReturnType<Document['createAccessor']> {
  const accessor = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function addSceneNode(doc: Document, node: GltfNode): GltfNode {
  const scene = doc.getRoot().listScenes()[0]
  if (scene === undefined) {
    throw new Error('the fixture scene is missing')
  }
  scene.addChild(node)
  return node
}

// One mesh, one primitive: the simplest thing a draw call is spent on.
function addPartMesh(doc: Document, name: string): GltfNode {
  const mesh = doc.createMesh(name)
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]))
  primitive.setIndices(quadIndices(doc))
  mesh.addPrimitive(primitive)
  return addSceneNode(doc, doc.createNode(name).setMesh(mesh))
}

function addHotspots(doc: Document, names: readonly string[], parent: HotspotParent): void {
  const parentNode =
    parent.kind === 'scene'
      ? null
      : (doc
          .getRoot()
          .listNodes()
          .find((node) => node.getName() === parent.name) ?? null)
  for (const name of names) {
    const hotspot = doc.createNode(name)
    if (parentNode === null) {
      addSceneNode(doc, hotspot)
    } else {
      parentNode.addChild(hotspot)
    }
  }
}

function addCameras(doc: Document, names: readonly string[], pose: CameraPose): void {
  for (const name of names) {
    const camera = doc
      .createCamera(name)
      .setYFov((pose.fovYDegrees * Math.PI) / 180)
      .setAspectRatio(pose.aspect)
    const node = doc.createNode(name).setCamera(camera).setTranslation(pose.position)
    if (pose.rotation !== undefined) {
      node.setRotation(pose.rotation)
    }
    addSceneNode(doc, node)
  }
}

function addVariants(doc: Document, names: readonly string[]): void {
  const variants = doc.createExtension(KHRMaterialsVariants)
  const mesh = doc.createMesh('body-variants')
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0]))
  primitive.setIndices(quadIndices(doc))
  // The one occlusion image every lit material samples, through the second
  // UV set: the contract's occlusion rule, so the default document is its
  // passing case like every other rule's. The image bytes are a valid
  // minimal PNG, so a write and read back of the document keeps the slot.
  const occlusion = doc.createTexture('T_ao').setMimeType('image/png').setImage(pngBytes(4, 4))
  const mappingList: MappingList = variants.createMappingList()
  for (const name of names) {
    const variant = variants.createVariant(name)
    const mapping = variants.createMapping()
    const material = doc.createMaterial(`body-${name}`).setOcclusionTexture(occlusion)
    material.getOcclusionTextureInfo()?.setTexCoord(1)
    mapping.setMaterial(material)
    mapping.addVariant(variant)
    mappingList.addMapping(mapping)
  }
  primitive.setExtension('KHR_materials_variants', mappingList)
  // The assigned material is the first declared finish, the default the
  // panel names when nothing is selected.
  const defaultMaterial = doc
    .createMaterial(`body-${names[0] ?? 'default'}`)
    .setOcclusionTexture(occlusion)
  defaultMaterial.getOcclusionTextureInfo()?.setTexCoord(1)
  primitive.setMaterial(defaultMaterial)
  mesh.addPrimitive(primitive)
  addSceneNode(doc, doc.createNode('PART_body').setMesh(mesh))
}

// The shadow plane the contract asks for: a root mesh whose one material
// is unlit, alpha BLEND, with no variant mapping.
function addShadow(doc: Document): void {
  const unlit = doc.createExtension(KHRMaterialsUnlit)
  const material = doc
    .createMaterial('MAT_shadow')
    .setAlphaMode('BLEND')
    .setExtension('KHR_materials_unlit', unlit.createUnlit())
  const mesh = doc.createMesh('shadow')
  const primitive = doc.createPrimitive()
  // Inside the parts' own box, so the shadow adds its primitive without
  // moving the frame every camera number reads.
  primitive.setAttribute(
    'POSITION',
    vec3Accessor(doc, [0.2, 0.9, 0, 1.8, 0.9, 0, 0.2, 1.1, 0, 1.8, 1.1, 0]),
  )
  primitive.setIndices(quadIndices(doc))
  primitive.setMaterial(material)
  mesh.addPrimitive(primitive)
  addSceneNode(doc, doc.createNode('SHADOW').setMesh(mesh))
}

function addAnimations(doc: Document, names: readonly string[]): void {
  const target = doc
    .getRoot()
    .listNodes()
    .find((node) => node.getName() === 'PART_base')
  if (target === undefined) {
    throw new Error('the fixture part is missing')
  }
  for (const name of names) {
    const animation = doc.createAnimation(name)
    const sampler = doc.createAnimationSampler()
    sampler.setInput(scalarAccessor(doc, [0, 1]))
    sampler.setOutput(vec3Accessor(doc, [0, 0, 0, 0, 1, 0]))
    animation.addSampler(sampler)
    const channel = doc.createAnimationChannel()
    channel.setSampler(sampler)
    channel.setTargetNode(target)
    channel.setTargetPath('translation')
    animation.addChannel(channel)
  }
}

// The contract document every check passes on: two parts, the hotspots on a
// part, both cameras in the passing pose, the variants, one clip per given
// name, Meshopt marked.
export function buildDocument(options: DocumentOptions = {}): Document {
  const {
    hotspotNames,
    hotspotParent = { kind: 'node', name: 'PART_base' },
    cameraNames = ['CAM_home', 'CAM_driver'],
    cameraPose = PASSING_CAMERA_POSE,
    variantNames = ['sage', 'graphite'],
    animationNames = ['Explode'],
    meshopt = true,
  } = options
  const doc = new Document()
  doc.createBuffer()
  doc.createScene('Scene')
  addPartMesh(doc, 'PART_base')
  addPartMesh(doc, 'PART_knob')
  addVariants(doc, variantNames)
  addCameras(doc, cameraNames, cameraPose)
  addHotspots(doc, hotspotNames ?? [], hotspotParent)
  addAnimations(doc, animationNames)
  addShadow(doc)
  if (meshopt) {
    doc.createExtension(EXTMeshoptCompression)
  }
  return doc
}

// A standalone scene-root node, for tests that graft on one more node.
export function addRootNode(doc: Document, name: string): GltfNode {
  return addSceneNode(doc, doc.createNode(name))
}

// The node of the given name in the fixture document.
export function nodeNamed(doc: Document, name: string): GltfNode {
  const node = doc
    .getRoot()
    .listNodes()
    .find((candidate) => candidate.getName() === name)
  if (node === undefined) {
    throw new Error(`the fixture node ${name} is missing`)
  }
  return node
}

// Hangs the named node under an unnamed wrapper, the kind quantization
// inserts, whose scale overflows the node's world matrix to infinity: a
// node whose rest position cannot be read.
export function hangUnreadable(doc: Document, name: string): void {
  const node = nodeNamed(doc, name)
  const parent = node.getParentNode()
  if (parent === null) {
    throw new Error(`the fixture ${name} hangs in the scene root`)
  }
  const wrapper = doc.createNode('').setScale([Number.MAX_VALUE, 1, 1])
  parent.removeChild(node)
  parent.addChild(wrapper)
  wrapper.addChild(node.setTranslation([Number.MAX_VALUE, 0, 0]))
}
