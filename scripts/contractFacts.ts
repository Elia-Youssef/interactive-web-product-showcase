// The contract facts the byte-level rule table reads from a product
// document: nodes and their transforms, cameras' world up, materials,
// primitives with their topology, the variant mappings, and the document's
// extensions, lights and extras. Plain data, like the structure facts
// beside it, so every rule stays a pure function and the document never
// leaves the model step.

import type { Document, Node, Property } from '@gltf-transform/core'
import { type MappingList } from '@gltf-transform/extensions'
import { isMat4 } from '../src/lib/camera/frame.ts'
import type { Vec3 } from '../src/lib/camera/frame.ts'
import { nearestNamedAncestorOf, primitiveFacts } from './contractPrimitiveFacts.ts'
import type { ContractPrimitiveFact } from './contractPrimitiveFacts.ts'

// One named node: whether it is a root object (no parent node), the
// translation and rotation the document authors (null when absent), and
// whether the node itself carries a mesh.
export type ContractNodeFact = {
  readonly name: string
  readonly rooted: boolean
  readonly translation: Vec3 | null
  readonly rotation: readonly [number, number, number, number] | null
  readonly carriesMesh: boolean
}

// One camera node's world up column: the direction the stored camera calls
// up, which the roll rule compares with the roll-free up the viewer
// rebuilds. null when the camera is not perspective (it carries no view).
export type ContractCameraFact = {
  readonly name: string
  readonly up: Vec3 | null
}

// One material: the slots the render contract reads. The occlusion facts
// name the texture the material's occlusion slot samples: the image as the
// document's own texture index (one glTF image is one texture, so an index
// shared by two materials is one image), and the texCoord set the slot
// reads; both are null when the material carries no occlusion texture.
export type ContractMaterialFact = {
  readonly index: number
  readonly name: string
  readonly unlit: boolean
  readonly doubleSided: boolean
  readonly alphaMode: string
  readonly normalMapped: boolean
  readonly occlusionImage: number | null
  readonly occlusionTexCoord: number | null
}

// One primitive, named by the node whose mesh holds it: the materials it
// can wear (its default plus every variant mapping), whether it carries a
// TANGENT attribute, whether its triangles leave an open edge, and how
// many coincident duplicate triangles it holds.
export type { ContractPrimitiveFact } from './contractPrimitiveFacts.ts'

// One mapped primitive's variant table: its default material and every
// mapping's material with the variants it names.
export type ContractMappingFact = {
  readonly nodeName: string
  readonly defaultMaterialName: string | null
  readonly defaultMaterialIndex: number | null
  readonly mappings: readonly {
    readonly materialName: string | null
    readonly materialIndex: number | null
    readonly variantNames: readonly string[]
  }[]
}

export type ContractModelFacts = {
  readonly nodes: readonly ContractNodeFact[]
  readonly cameras: readonly ContractCameraFact[]
  readonly materials: readonly ContractMaterialFact[]
  readonly primitives: readonly ContractPrimitiveFact[]
  readonly mappings: readonly ContractMappingFact[]
  readonly extensionsUsed: readonly string[]
  readonly lightsPresent: boolean
  readonly extrasBearers: readonly string[]
}

const LIGHTS_EXTENSION = 'KHR_lights_punctual'

export function readContractModelFacts(doc: Document): ContractModelFacts {
  const root = doc.getRoot()
  const nodes = root.listNodes().filter((node) => node.getName() !== '')
  const textures = root.listTextures()
  return {
    nodes: nodes.map((node) => ({
      name: node.getName(),
      rooted: node.getParentNode() === null,
      translation: vec3OrNull(node.getTranslation()),
      rotation: quaternionOrNull(node.getRotation()),
      carriesMesh: node.getMesh() !== null,
    })),
    cameras: root
      .listNodes()
      .map(cameraUpOf)
      .filter((fact) => fact !== null),
    materials: root.listMaterials().map((material, index) => {
      const occlusion = material.getOcclusionTexture()
      return {
        index,
        name: material.getName(),
        unlit: material.getExtension('KHR_materials_unlit') !== null,
        doubleSided: material.getDoubleSided(),
        alphaMode: material.getAlphaMode() ?? 'OPAQUE',
        normalMapped: material.getNormalTexture() !== null,
        occlusionImage: occlusion === null ? null : textures.indexOf(occlusion),
        occlusionTexCoord:
          occlusion === null ? null : (material.getOcclusionTextureInfo()?.getTexCoord() ?? 0),
      }
    }),
    primitives: primitiveFacts(doc),
    mappings: mappingFacts(doc),
    extensionsUsed: root.listExtensionsUsed().map((extension) => extension.extensionName),
    lightsPresent:
      root.listExtensionsUsed().some((e) => e.extensionName === LIGHTS_EXTENSION) ||
      root.listNodes().some((node) => node.getExtension(LIGHTS_EXTENSION) !== null),
    extrasBearers: extrasBearers(doc),
  }
}

// The camera's world up column, or null for a node with no camera or one
// that is not perspective: the roll rule reads only cameras the site can
// present.
function cameraUpOf(node: Node): ContractCameraFact | null {
  const camera = node.getCamera()
  if (camera === null || camera.getType() !== 'perspective') {
    return null
  }
  const world = node.getWorldMatrix()
  if (!isMat4(world)) {
    return null
  }
  return { name: node.getName(), up: [world[4] ?? 0, world[5] ?? 0, world[6] ?? 0] }
}

function vec3OrNull(values: readonly number[] | null): Vec3 | null {
  if (values === null) {
    return null
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
}

function quaternionOrNull(
  values: readonly number[] | null,
): readonly [number, number, number, number] | null {
  if (values === null) {
    return null
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1]
}

// Every mapped primitive's variant table.
function mappingFacts(doc: Document): ContractMappingFact[] {
  const facts: ContractMappingFact[] = []
  const materials = doc.getRoot().listMaterials()
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) {
      continue
    }
    const nodeName = node.getName() !== '' ? node.getName() : nearestNamedAncestorOf(node)
    for (const primitive of mesh.listPrimitives()) {
      const list = primitive.getExtension<MappingList>('KHR_materials_variants')
      if (list === null) {
        continue
      }
      const defaultMaterial = primitive.getMaterial()
      facts.push({
        nodeName,
        defaultMaterialName: defaultMaterial?.getName() ?? null,
        defaultMaterialIndex: defaultMaterial === null ? null : materials.indexOf(defaultMaterial),
        mappings: list.listMappings().map((mapping) => {
          const material = mapping.getMaterial()
          return {
            materialName: material?.getName() ?? null,
            materialIndex: material === null ? null : materials.indexOf(material),
            variantNames: mapping.listVariants().map((variant) => variant.getName()),
          }
        }),
      })
    }
  }
  return facts
}

// Every property of every table that carries extras, labelled by its table
// and name: the rule reports exactly where the file leaks authoring data.
function extrasBearers(doc: Document): readonly string[] {
  const bearers: string[] = []
  const tables: readonly (readonly [string, readonly Property[]])[] = [
    ['node', doc.getRoot().listNodes()],
    ['mesh', doc.getRoot().listMeshes()],
    ['material', doc.getRoot().listMaterials()],
    ['camera', doc.getRoot().listCameras()],
    ['animation', doc.getRoot().listAnimations()],
    ['accessor', doc.getRoot().listAccessors()],
    ['buffer', doc.getRoot().listBuffers()],
    ['scene', doc.getRoot().listScenes()],
  ]
  for (const [table, properties] of tables) {
    for (const property of properties) {
      const extras = property.getExtras()
      if (extras !== null && Object.keys(extras).length > 0) {
        bearers.push(`${table} ${property.getName() || '(unnamed)'}`)
      }
    }
  }
  return bearers
}
