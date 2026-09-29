// The in-memory contract document for the validate suites: the shapes the
// Blender contract names (parts, hotspots, cameras, variants, the explode
// clip), built with @gltf-transform/core so no test needs Blender or
// KTX-Software. Every option bends one rule, which is how a suite asserts
// the exact violation.
import { Document, type Node as GltfNode } from '@gltf-transform/core'
import {
  EXTMeshoptCompression,
  KHRMaterialsVariants,
  type MappingList,
} from '@gltf-transform/extensions'

// Where the fixture hotspots hang. The two kinds are distinct tags, not one
// string, so parenting to a node literally named 'scene' stays expressible
// and can never be misread as the scene root.
export type HotspotParent =
  { readonly kind: 'node'; readonly name: string } | { readonly kind: 'scene' }

export type DocumentOptions = {
  // HS_ node names, parented to the named node (or the scene root).
  hotspotNames?: string[]
  hotspotParent?: HotspotParent
  cameraNames?: string[]
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

function addCameras(doc: Document, names: readonly string[]): void {
  for (const name of names) {
    addSceneNode(doc, doc.createNode(name).setCamera(doc.createCamera(name)))
  }
}

function addVariants(doc: Document, names: readonly string[]): void {
  const variants = doc.createExtension(KHRMaterialsVariants)
  const mesh = doc.createMesh('body-variants')
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0]))
  primitive.setIndices(quadIndices(doc))
  const mappingList: MappingList = variants.createMappingList()
  for (const name of names) {
    const variant = variants.createVariant(name)
    const mapping = variants.createMapping()
    mapping.setMaterial(doc.createMaterial(`body-${name}`))
    mapping.addVariant(variant)
    mappingList.addMapping(mapping)
  }
  primitive.setExtension('KHR_materials_variants', mappingList)
  mesh.addPrimitive(primitive)
  addSceneNode(doc, doc.createNode('PART_body').setMesh(mesh))
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
// part, both cameras, the variants, one clip per given name, Meshopt marked.
export function buildDocument(options: DocumentOptions = {}): Document {
  const {
    hotspotNames,
    hotspotParent = { kind: 'node', name: 'PART_base' },
    cameraNames = ['CAM_home', 'CAM_driver'],
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
  addCameras(doc, cameraNames)
  addHotspots(doc, hotspotNames ?? [], hotspotParent)
  addAnimations(doc, animationNames)
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
