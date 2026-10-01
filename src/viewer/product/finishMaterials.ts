import { Material } from 'three'
import { readFinishPlan, type FinishPlan } from '@lib/product'

// The loader plugin that loads every finish material as part of the model.
// GLTFLoader builds only the materials a scene's primitives name as their
// defaults; the materials the KHR_materials_variants mappings name would
// load lazily on the first switch. The plugin's afterRoot runs before the
// load resolves, resolves every material the plan names through the
// parser's own cache, and hands the resolved table to the parser, so
// useGLTF resolves with all of them ready and a switch never loads.

// The finish facts of one loaded product, resolved: the pure plan plus the
// material behind every index it names. The product owns these materials;
// they are released with the scene in the one release ProductContent holds.
export type ProductFinishMaterials = {
  readonly plan: FinishPlan
  readonly materials: ReadonlyMap<number, Material>
}

// The parser surface the resolver reads, kept structural: the loader hands
// its own parser, which carries this shape at runtime.
export interface FinishParserLike {
  readonly json: unknown
  getDependency(type: string, index: number): Promise<unknown>
}

// The glTF result the loader hands afterRoot, as far as the resolver needs
// it. userData is where the loader parks per-load payloads, and the one
// named key below is the resolver's; nothing else writes it.
export interface GltfResultLike {
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
  return Reflect.get(value, 'plan') !== undefined && Reflect.get(value, 'materials') instanceof Map
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
    const materials = new Map<number, Material>()
    for (const index of plan.materialIndexes) {
      const dependency: unknown = await this.parser.getDependency('material', index)
      if (!(dependency instanceof Material)) {
        throw new Error(`the finish material ${index} of the loaded product did not resolve`)
      }
      materials.set(index, dependency)
    }
    result.userData[FINISH_MATERIALS_KEY] = { plan, materials }
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
