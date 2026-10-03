import { Line, Material, Mesh, Points } from 'three'
import type { Object3D } from 'three'
import {
  finishDerivedKey,
  finishEntryMaterialIndexes,
  mappedFinishEntries,
  readFinishPlan,
  type FinishPlan,
} from '@lib/product'
import { mappedSceneNodes, type GltfAssociation } from './mappedSceneNodes'

// The loader plugin that loads every finish material as part of the model.
// GLTFLoader builds only the materials a scene's primitives name as their
// defaults; the materials the KHR_materials_variants mappings name would
// load lazily on the first switch. The plugin's afterRoot runs before the
// load resolves, resolves every material the plan names through the
// parser's own cache, derives the material every mapped mesh shows for
// every index its plan entry can give it, records every material the scene
// carries at that moment, and hands all of it to the parser, so useGLTF
// resolves with all of them ready and a switch never loads and never has
// to re-derive.

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
  readonly userData: { finishMaterials?: ProductFinishMaterials }
}

// The one key the resolver's table lives under on the result's userData.
const FINISH_MATERIALS_KEY = 'finishMaterials'

// Reads the finish materials a loaded product carries. A parser without
// them means the resolver never ran, which is a wiring error of the product
// path, not a property of the file: it fails loudly instead of letting a
// switch hit a half-loaded model.
export function readFinishMaterials(userData: object): ProductFinishMaterials {
  const carried: unknown = Reflect.get(userData, FINISH_MATERIALS_KEY)
  if (!isFinishMaterials(carried)) {
    throw new Error(
      'the loaded product carries no finish materials: the finish resolver did not run',
    )
  }
  return carried
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
    // The plan read validates the file's mappings: a mapping that names an
    // unknown variant or material fails the load here, with every problem
    // named by its mesh and primitive, instead of failing a switch later.
    const plan = readFinishPlan(this.parser.json)
    const rawMaterials = new Map<number, Material>()
    for (const index of plan.materialIndexes) {
      const dependency: unknown = await this.parser.getDependency('material', index)
      if (!(dependency instanceof Material)) {
        throw new Error(`the finish material ${index} of the loaded product did not resolve`)
      }
      rawMaterials.set(index, dependency)
    }
    result.userData[FINISH_MATERIALS_KEY] = {
      plan,
      materials: deriveFinishMaterials(result.scene, plan, rawMaterials, this.parser),
      rawMaterials,
      sceneMaterials: collectSceneMaterials(result.scene),
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
// purpose: the loader collects the factories it was given, and the product
// path re-wires the same loader instance on every load, so a fresh closure
// per call would grow the loader's plugin list for the page's lifetime. A
// parse constructs its own resolver from its own parser.
function finishResolverFactory(parser: FinishParserLike): FinishMaterialsResolver {
  return new FinishMaterialsResolver(parser)
}

// Registers the finish resolver next to the decoders, on the loader the
// product path configures.
export function registerFinishMaterialsResolver(loader: FinishLoaderLike): void {
  loader.register(finishResolverFactory)
}
