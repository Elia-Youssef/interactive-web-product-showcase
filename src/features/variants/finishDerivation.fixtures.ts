import { Document, NodeIO, type Accessor } from '@gltf-transform/core'
import type { Material as GltfMaterial } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'
import { AnimationClip, Mesh, MeshStandardMaterial, type Material } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect } from 'vitest'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import {
  registerFinishMaterialsResolver,
  readFinishResolution,
} from '@viewer/product/finishMaterials'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedSceneNode } from '@viewer/product/mappedSceneNodes'
import { mappedSceneMeshes } from './mappedMeshes'

// The fixture of the derivation class test: the in-memory GLB builder and
// the parse helpers finishDerivation.test.ts shares. The file is a fixture
// module, not a test file: the builder needs the dev-only gltf-transform,
// which the fixture category may import like a test file, while vitest
// collects nothing here and production code may not import the module at
// all. Its contract test lives in finishDerivation.test.ts, beside the
// class it feeds.

export const SAGE = 'sage'
export const GRAPHITE = 'graphite'
export const VARIANTS = [SAGE, GRAPHITE] as const

type FixturePrimitive = { readonly attrs: string; readonly raws: readonly [string, string, string] }
type FixturePart = { readonly name: string; readonly primitives: readonly FixturePrimitive[] }

// The fixture's mapped meshes: the attribute letters name the geometry each
// primitive carries, T TANGENT, N NORMAL, C COLOR_0, and the raws are the
// materials its default and its two mappings dress it in. PART_tangent
// derives to its raws; PART_plain's clones flip normalScale.y; PART_colored
// adds vertex colors; PART_flat and PART_flat2 go flat shaded, and flat2
// wears flat's raws with its default and sage swapped, so one raw material
// derives to the same shared clone on both meshes; PART_dual maps two
// primitives, one with a TANGENT and one without, each with its own raws.
const PARTS: readonly FixturePart[] = [
  {
    name: 'PART_tangent',
    primitives: [
      { attrs: 'TN', raws: ['MAT_tangent_default', 'MAT_tangent_sage', 'MAT_tangent_graphite'] },
    ],
  },
  {
    name: 'PART_plain',
    primitives: [
      { attrs: 'N', raws: ['MAT_plain_default', 'MAT_shared_sage', 'MAT_plain_graphite'] },
    ],
  },
  {
    name: 'PART_colored',
    primitives: [
      { attrs: 'NC', raws: ['MAT_colored_default', 'MAT_shared_sage', 'MAT_colored_graphite'] },
    ],
  },
  {
    name: 'PART_flat',
    primitives: [{ attrs: '', raws: ['MAT_flat_default', 'MAT_flat_sage', 'MAT_flat_graphite'] }],
  },
  {
    name: 'PART_flat2',
    primitives: [{ attrs: '', raws: ['MAT_flat_sage', 'MAT_flat_default', 'MAT_flat_graphite'] }],
  },
  {
    name: 'PART_dual',
    primitives: [
      { attrs: 'TN', raws: ['MAT_dual0_default', 'MAT_dual0_sage', 'MAT_dual0_graphite'] },
      { attrs: 'N', raws: ['MAT_dual1_default', 'MAT_dual1_sage', 'MAT_dual1_graphite'] },
    ],
  },
]

function accessor(
  doc: Document,
  type: 'SCALAR' | 'VEC3' | 'VEC4',
  array: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>,
): Accessor {
  const buffer = doc.getRoot().listBuffers()[0]
  const built = doc.createAccessor().setType(type).setArray(array)
  if (buffer !== undefined) {
    built.setBuffer(buffer)
  }
  return built
}

function primitiveAttributes(doc: Document, attrs: string): Record<string, Accessor> {
  const set: Record<string, Accessor> = {
    POSITION: accessor(doc, 'VEC3', new Float32Array(12)),
  }
  if (attrs.includes('N')) {
    set.NORMAL = accessor(doc, 'VEC3', new Float32Array(12))
  }
  if (attrs.includes('C')) {
    set.COLOR_0 = accessor(doc, 'VEC4', new Float32Array(16).fill(1))
  }
  if (attrs.includes('T')) {
    set.TANGENT = accessor(doc, 'VEC4', new Float32Array(16).fill(1))
  }
  return set
}

async function variantGlb(): Promise<ArrayBuffer> {
  const doc = new Document()
  doc.createBuffer()
  const scene = doc.createScene('Scene')
  const variants = doc.createExtension(KHRMaterialsVariants)
  const sage = variants.createVariant(SAGE)
  const graphite = variants.createVariant(GRAPHITE)
  const rawNames = [...new Set(PARTS.flatMap((part) => part.primitives).flatMap((p) => p.raws))]
  const raws = new Map(rawNames.map((name) => [name, doc.createMaterial(name)]))
  const raw = (name: string): GltfMaterial => {
    const found = raws.get(name)
    if (found === undefined) {
      throw new Error(`the fixture carries no material named ${name}`)
    }
    return found
  }

  for (const part of PARTS) {
    const mesh = doc.createMesh(part.name)
    for (const spec of part.primitives) {
      const primitive = doc.createPrimitive()
      for (const [semantic, attribute] of Object.entries(primitiveAttributes(doc, spec.attrs))) {
        primitive.setAttribute(semantic, attribute)
      }
      primitive.setIndices(accessor(doc, 'SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3])))
      const list: MappingList = variants.createMappingList()
      list.addMapping(variants.createMapping().setMaterial(raw(spec.raws[1])).addVariant(sage))
      list.addMapping(variants.createMapping().setMaterial(raw(spec.raws[2])).addVariant(graphite))
      primitive.setMaterial(raw(spec.raws[0]))
      primitive.setExtension('KHR_materials_variants', list)
      mesh.addPrimitive(primitive)
    }
    scene.addChild(doc.createNode(part.name).setMesh(mesh))
  }

  const bytes = await new NodeIO().registerExtensions([KHRMaterialsVariants]).writeBinary(doc)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

// The finish materials a fixture load resolved; a broken mapping fails the
// fixture, since every fixture file maps valid variants.
function resolvedFinishes(userData: object) {
  const finish = readFinishResolution(userData)
  if (finish.kind === 'broken') {
    throw new Error(`the fixture's finish mapping broke: ${JSON.stringify(finish.problems)}`)
  }
  return finish.finishes
}

// Parses the fixture with the real loader and the product's real resolver,
// and hands the load plus an oracle: the material the loader itself derives
// for a mesh from one raw material, read off a probe mesh through the
// parser's own assignFinalMaterial.
export async function parsedLoad(): Promise<{
  loaded: LoadedProduct
  loaderDerives: (mesh: Mesh, materialIndex: number) => Material
}> {
  const loader = new GLTFLoader()
  registerFinishMaterialsResolver(loader)
  const gltf = await loader.parseAsync(await variantGlb(), '')
  const loaded: LoadedProduct = {
    manifest: parseProduct(sampleOneManifest, 'fixture'),
    scene: gltf.scene,
    rig: {
      parts: new Map(),
      hotspots: [],
      cameras: new Map(),
      shadow: gltf.scene,
      clip: new AnimationClip('Explode', 1, []),
      variants: [...VARIANTS],
      anchorRest: new Map(),
    },
    parser: gltf.parser,
    finishes: resolvedFinishes(gltf.userData),
  }
  return {
    loaded,
    loaderDerives: (mesh, materialIndex) => {
      const material = loaded.finishes.rawMaterials.get(materialIndex)
      if (material === undefined) {
        throw new Error(`the load resolved no raw material for the index ${materialIndex}`)
      }
      const probe = new Mesh(mesh.geometry, material)
      gltf.parser.assignFinalMaterial(probe)
      if (Array.isArray(probe.material)) {
        throw new Error('the loader derived a material array on the probe')
      }
      return probe.material
    },
  }
}

export function namedMesh(loaded: LoadedProduct, name: string): Mesh {
  let found: Mesh | undefined
  loaded.scene.traverse((node) => {
    if (node instanceof Mesh && node.name === name) {
      found = node
    }
  })
  if (found === undefined) {
    throw new Error(`the parsed scene holds no mesh named ${name}`)
  }
  return found
}

export function singleStandard(mesh: Mesh): MeshStandardMaterial {
  if (Array.isArray(mesh.material) || !(mesh.material instanceof MeshStandardMaterial)) {
    throw new Error(`the mesh '${mesh.name}' does not carry one standard material`)
  }
  return mesh.material
}

// The flags the loader's own rule reads off the mesh's geometry, held
// against the applied material: the normalScale flip without a TANGENT,
// vertex colors with COLOR_0, flat shading without normals.
export function expectDerivationFlags(mesh: Mesh, material: MeshStandardMaterial): void {
  const geometry = mesh.geometry
  expect(material.normalScale.y, `the normalScale of '${mesh.name}'`).toBe(
    geometry.attributes.tangent === undefined ? -1 : 1,
  )
  expect(material.vertexColors, `the vertex colors of '${mesh.name}'`).toBe(
    geometry.attributes.color !== undefined,
  )
  expect(material.flatShading, `the flat shading of '${mesh.name}'`).toBe(
    geometry.attributes.normal === undefined,
  )
}

// The two mapped nodes of the fixture's two-primitive mesh, found by their
// loader associations rather than their names, which the loader derives
// from the one mesh definition.
export function dualPrimitives(loaded: LoadedProduct): {
  zero: MappedSceneNode
  one: MappedSceneNode
} {
  const mapped = mappedSceneMeshes(loaded)
  const counts = new Map<number, number>()
  for (const { entry } of mapped) {
    counts.set(entry.mesh, (counts.get(entry.mesh) ?? 0) + 1)
  }
  const dual = [...counts.entries()].find(([, count]) => count === 2)
  if (dual === undefined) {
    throw new Error('the fixture must map a mesh with two primitives')
  }
  const byPrimitive = (primitive: number): MappedSceneNode | undefined =>
    mapped.find(({ entry }) => entry.mesh === dual[0] && entry.primitive === primitive)
  const zero = byPrimitive(0)
  const one = byPrimitive(1)
  if (zero === undefined || one === undefined) {
    throw new Error('the two-primitive mesh must map both of its primitives')
  }
  return { zero, one }
}
