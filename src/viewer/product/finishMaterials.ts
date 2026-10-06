import { Line, Material, Mesh, Points, Vector2 } from 'three'
import type { Object3D } from 'three'
import { uniform } from 'three/tsl'
import {
  finishDerivedKey,
  finishEntryMaterialIndexes,
  mappedFinishEntries,
  readFinishPlan,
  type FinishPlan,
  type FinishProblem,
} from '@lib/product'
import { mappedSceneNodes, type GltfAssociation } from './mappedSceneNodes'

// The loader plugin that loads every finish material as part of the model.
// GLTFLoader builds only the materials a scene's primitives name as their
// defaults; the materials the KHR_materials_variants mappings name would
// load lazily on the first switch. The plugin's afterRoot runs before the
// load resolves, resolves every material the plan names through the
// parser's own cache, derives the material every mapped mesh shows for
// every index its plan entry can give it, records every material the scene
// carries at that moment, and hands all of it to the parser, so the model
// load resolves with all of them ready and a switch never loads and never has
// to re-derive.
//
// After the derivation, every material instance the product can render is
// prepared for the node renderer:
//
// 1. Its own program cache key (Material.customProgramCacheKey). The node
//    renderer dedupes a material's node builder state, its uniform buffers
//    and its change monitor by the material's feature flags alone: numbers
//    in the key collapse to set and unset, so two materials that differ only
//    in a continuous value share one builder state, and a shared state
//    carries the first material's value nodes for every sharer.
//
// 2. An anisotropy value node of its own, when the material is anisotropic
//    without an anisotropy map. The shared uniform the node renderer uses
//    otherwise holds the anisotropy vector of whichever material refreshed
//    last, updated once per material and render, so a later render object of
//    an earlier material reads another material's vector into its own uniform
//    buffer, where the value freezes once the stage is at rest. The rendered
//    anisotropy then depends on the load. A per-material static node removes
//    the shared slot: the vector is the material's own constant.
function markMaterialOwnership(material: Material): void {
  material.customProgramCacheKey = () => material.uuid
}

// The node material reads the render-time anisotropy vector from
// `anisotropyNode` when it is set (three's MeshPhysicalNodeMaterial), with
// the same polar form the shared uniform would carry. The classic material
// type does not declare the field, so the accessor is structural, carrying
// the anisotropy surface the file's materials are built with.
type MaterialWithAnisotropy = Material & {
  anisotropy?: number
  anisotropyRotation?: number
  anisotropyMap?: unknown
  anisotropyNode?: unknown
}

function markAnisotropyOwnership(material: Material): void {
  const carrier = material as MaterialWithAnisotropy
  const anisotropy = carrier.anisotropy
  const hasMap = carrier.anisotropyMap !== null && carrier.anisotropyMap !== undefined
  if (anisotropy === undefined || anisotropy <= 0 || hasMap || carrier.anisotropyNode != null) {
    return
  }
  const rotation = carrier.anisotropyRotation ?? 0
  carrier.anisotropyNode = uniform(
    new Vector2(anisotropy * Math.cos(rotation), anisotropy * Math.sin(rotation)),
  )
}

// Prepares one material instance: its own builder state, and its own
// anisotropy value where the file carries one.
function markMaterial(material: Material): void {
  markMaterialOwnership(material)
  markAnisotropyOwnership(material)
}

// Prepares every material of a parsed scene, single or per-group array: each
// material instance the scene carries leaves the walk as the owner of its
// node builder state and of its anisotropy value.
export function markSceneMaterials(scene: Object3D): void {
  scene.traverse((node) => {
    if (node instanceof Mesh || node instanceof Line || node instanceof Points) {
      if (Array.isArray(node.material)) {
        for (const material of node.material) {
          markMaterial(material)
        }
        return
      }
      markMaterial(node.material)
    }
  })
}

// What the glTF loader recorded about one object it built is declared with
// the scene walk that reads it, in mappedSceneNodes, and imported by the
// parser surfaces here and in loadedProduct.

// The finish facts of one loaded product, resolved: the pure plan, the
// derived material behind every mapped primitive and material index pair,
// the raw parser materials the derivations started from, and the materials
// the scene carried at parse time. The product owns all of them; they are
// released with the scene in the one release ProductContent holds.
export type ProductFinishMaterials = {
  readonly plan: FinishPlan
  // The material each mapped primitive shows for each material index its
  // plan entry can give it, keyed by the primitive and the index. Each one
  // is the loader's own derivation for that mesh, run once at load: the raw
  // material itself where the mesh's geometry asks for no clone, and the
  // loader's cached clone where it does, with the negated normalScale.y of
  // a tangent-less mesh, the vertex colors of a COLOR_0 mesh and the flat
  // shading of a mesh without normals. Every application assigns from this
  // table, so a swap can never put a raw material, or a clone derived for
  // another mesh's geometry, on a mesh.
  readonly materials: ReadonlyMap<string, Material>
  // The loader's own material instances behind the plan's indexes, the
  // input every derivation starts from. No mesh carries them again once a
  // finish is applied, so the record is what still names them at teardown.
  readonly rawMaterials: ReadonlyMap<number, Material>
  // The materials the scene carried when the load was parsed, recorded
  // before any finish swap: the loader's per-mesh derivations of the
  // defaults included. A swap replaces them on the meshes, so the
  // teardown's scene traversal no longer sees them; this record does, and
  // the release disposes them with the load they came from.
  readonly sceneMaterials: ReadonlySet<Material>
}

// The parser surface the resolver reads, kept structural: the loader hands
// its own parser, which carries this shape at runtime.
export interface FinishParserLike {
  readonly json: unknown
  readonly associations: ReadonlyMap<object, GltfAssociation>
  getDependency(type: string, index: number): Promise<unknown>
  // The loader's own per-mesh material derivation, the one the mesh build
  // ran on every primitive. It reads the material on the mesh as its input,
  // so a derivation the resolver runs starts from the raw parser material,
  // never from a clone a mesh already carries.
  assignFinalMaterial(mesh: Mesh): void
}

// The glTF result the loader hands afterRoot, as far as the resolver needs
// it: the parsed scene whose materials it derives and records, and
// userData, where the loader parks per-load payloads and the one named key
// below is the resolver's; nothing else writes it.
export interface GltfResultLike {
  readonly scene: Object3D
  readonly userData: { finishMaterials?: FinishResolution }
}

// What the resolver leaves on a load: the resolved finish materials, or
// every problem of a file whose finish mappings cannot be read. A broken
// mapping is a property of the file the product path anticipates, so the
// resolver records it as the load's outcome instead of failing the parse,
// and the product reports it as a contract failure with its problems.
export type FinishResolution =
  | { readonly kind: 'resolved'; readonly finishes: ProductFinishMaterials }
  | { readonly kind: 'broken'; readonly problems: readonly FinishProblem[] }

// The one key the resolver's outcome lives under on the result's userData.
const FINISH_MATERIALS_KEY = 'finishMaterials'

// Reads the finish outcome a loaded product carries. A load without one
// means the resolver never ran, which is a wiring error of the product
// path, not a property of the file: it fails loudly instead of letting a
// switch hit a half-loaded model.
export function readFinishResolution(userData: object): FinishResolution {
  const carried: unknown = Reflect.get(userData, FINISH_MATERIALS_KEY)
  if (!isFinishResolution(carried)) {
    throw new Error('the loaded product carries no finish outcome: the finish resolver did not run')
  }
  return carried
}

function isFinishResolution(value: unknown): value is FinishResolution {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  switch (Reflect.get(value, 'kind')) {
    case 'resolved':
      return isFinishMaterials(Reflect.get(value, 'finishes'))
    case 'broken':
      return Array.isArray(Reflect.get(value, 'problems'))
    default:
      return false
  }
}

function isFinishMaterials(value: unknown): value is ProductFinishMaterials {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    Reflect.get(value, 'plan') !== undefined &&
    Reflect.get(value, 'materials') instanceof Map &&
    Reflect.get(value, 'rawMaterials') instanceof Map &&
    Reflect.get(value, 'sceneMaterials') instanceof Set
  )
}

// Every material the drawable nodes of the parsed scene carry, single or
// per-group array. The walk runs in the resolver's afterRoot, after the
// derivation restored every mesh's parse-time material and before the load
// resolves and any finish swap can replace one.
function collectSceneMaterials(scene: Object3D): Set<Material> {
  const materials = new Set<Material>()
  const collect = (material: Material | Material[]): void => {
    if (Array.isArray(material)) {
      for (const entry of material) {
        materials.add(entry)
      }
      return
    }
    materials.add(material)
  }
  scene.traverse((node) => {
    if (node instanceof Mesh || node instanceof Line || node instanceof Points) {
      collect(node.material)
    }
  })
  return materials
}

// The derived materials of a parsed scene: for every mapped mesh, the
// material the loader derives for each material index its plan entry can
// give it, keyed by the primitive and the index. Each derivation runs the
// parser's own assignFinalMaterial on the mesh the primitive built, so the
// loader's clone flags read the mesh's own geometry, and the loader's cache
// shares the result wherever the flags agree. The derivation always starts
// from the raw parser material, never from the material on the mesh: the
// loader reads its input there, so deriving from a clone would clone the
// clone and flip a negated normalScale back. Every mesh ends the walk
// dressed as the parse left it.
function deriveFinishMaterials(
  scene: Object3D,
  plan: FinishPlan,
  rawMaterials: ReadonlyMap<number, Material>,
  parser: FinishParserLike,
): Map<string, Material> {
  const materials = new Map<string, Material>()
  const mapped = mappedSceneNodes(scene, parser.associations, mappedFinishEntries(plan))
  for (const { mesh, entry } of mapped) {
    const original = mesh.material
    try {
      for (const materialIndex of finishEntryMaterialIndexes(entry)) {
        const raw = rawMaterials.get(materialIndex)
        if (raw === undefined) {
          throw new Error(
            `the finish material ${materialIndex} of the loaded product did not resolve`,
          )
        }
        mesh.material = raw
        parser.assignFinalMaterial(mesh)
        const derived = mesh.material
        if (Array.isArray(derived)) {
          throw new Error(`the loader derived a material array for the mapped mesh '${mesh.name}'`)
        }
        materials.set(finishDerivedKey(entry.mesh, entry.primitive, materialIndex), derived)
      }
    } finally {
      mesh.material = original
    }
  }
  return materials
}

class FinishMaterialsResolver {
  // The name the loader keys every plugin by, even one it never looks up
  // as an extension handler: a nameless plugin is a console error and an
  // undefined key in the parser's bookkeeping. The name is not an extension
  // the file can list, so it changes nothing about how the loader treats
  // the real KHR_materials_variants entry.
  static readonly name = 'PRODUCT_finish_materials'

  constructor(private readonly parser: FinishParserLike) {}

  get name(): string {
    return FinishMaterialsResolver.name
  }

  async afterRoot(result: GltfResultLike): Promise<void> {
    // The scene's materials are prepared before the plan is read, so a file
    // with broken finish mappings prepares its carried materials all the same.
    markSceneMaterials(result.scene)
    // The plan read validates the file's mappings: a mapping that names an
    // unknown variant or material is recorded as the load's broken outcome,
    // with every problem named by its mesh and primitive, so the product
    // fails on it before any switch could hit it.
    const read = readFinishPlan(this.parser.json)
    if (read.kind === 'broken') {
      result.userData[FINISH_MATERIALS_KEY] = read
      return
    }
    const { plan } = read
    const rawMaterials = new Map<number, Material>()
    for (const index of plan.materialIndexes) {
      const dependency: unknown = await this.parser.getDependency('material', index)
      if (!(dependency instanceof Material)) {
        throw new Error(`the finish material ${index} of the loaded product did not resolve`)
      }
      rawMaterials.set(index, dependency)
    }
    const materials = deriveFinishMaterials(result.scene, plan, rawMaterials, this.parser)
    // The derivations sit in the loader's own clone cache, one per distinct
    // geometry flag set, and a clone loses the preparation its source got
    // (Material.copy copies values, not the instance's own fields), so the
    // table is prepared after the derivation. The scene walk covers the
    // meshes' parse-time materials again; both walks are idempotent.
    markSceneMaterials(result.scene)
    for (const material of materials.values()) {
      markMaterial(material)
    }
    result.userData[FINISH_MATERIALS_KEY] = {
      kind: 'resolved',
      finishes: {
        plan,
        materials,
        rawMaterials,
        sceneMaterials: collectSceneMaterials(result.scene),
      },
    }
  }
}

// The loader surface the resolver registers through, kept structural and
// declared here so the resolver owns its whole contract: the loader the
// product path configures hands its register call a parser of a parse.
export interface FinishLoaderLike {
  register(factory: (parser: FinishParserLike) => unknown): unknown
}

// The one factory the wiring registers. It is a stable module function on
// purpose: the loader collects the factories it was given and dedupes them
// by identity, so wiring a loader twice never grows its plugin list. A
// parse constructs its own resolver from its own parser.
function finishResolverFactory(parser: FinishParserLike): FinishMaterialsResolver {
  return new FinishMaterialsResolver(parser)
}

// Registers the finish resolver next to the decoders, on the loader the
// product path configures.
export function registerFinishMaterialsResolver(loader: FinishLoaderLike): void {
  loader.register(finishResolverFactory)
}
