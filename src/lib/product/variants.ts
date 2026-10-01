// The finish plan of a loaded glTF file: the variant names the file
// declares and, per mesh primitive, the material each variant maps it to.
// The plan is pure and structural: it reads the untyped parser JSON, so a
// test builds it from plain fixtures, and everything downstream reads the
// same plan instead of touching the JSON again.

const VARIANTS_EXTENSION = 'KHR_materials_variants'

// One key of an untyped JSON table, undefined when the table is no object
// or the key is absent. The one guarded reader every glTF JSON read here
// goes through.
export function readJsonKey(table: unknown, key: string): unknown {
  return typeof table === 'object' && table !== null && key in table
    ? Reflect.get(table, key)
    : undefined
}

// The variant names from a parser JSON's KHR_materials_variants, in
// declaration order, empty when the file carries none. A missing or
// malformed table reads as empty instead of guessing.
export function readVariantNames(json: unknown): readonly string[] {
  const variants = readJsonKey(
    readJsonKey(readJsonKey(json, 'extensions'), VARIANTS_EXTENSION),
    'variants',
  )
  if (!Array.isArray(variants)) {
    return []
  }
  return variants.flatMap((entry) => {
    const name =
      typeof entry === 'object' && entry !== null ? readJsonKey(entry, 'name') : undefined
    return typeof name === 'string' ? [name] : []
  })
}

// One problem that makes a file's finish mapping unusable, named by the
// mesh and primitive it sits on when there are ones.
export type FinishProblem = {
  readonly mesh: number | null
  readonly primitive: number | null
  readonly message: string
}

function formatProblemLine(problem: FinishProblem): string {
  const at =
    problem.mesh === null
      ? ''
      : `mesh ${problem.mesh}${problem.primitive === null ? '' : ` primitive ${problem.primitive}`}: `
  return `- ${at}${problem.message}`
}

// The typed error of the finish plan, modeled on ProductRigError: a file
// whose mappings cannot be read fails with every problem listed at once,
// each named by its mesh and primitive.
export class FinishPlanError extends Error {
  readonly problems: readonly FinishProblem[]

  constructor(problems: readonly FinishProblem[]) {
    super(`Invalid finish plan:\n${problems.map(formatProblemLine).join('\n')}`)
    this.name = 'FinishPlanError'
    this.problems = problems
  }
}

// What one mesh primitive carries across the finishes: the material the
// file gives it as its default, and the material each mapped variant
// replaces it with. A variant the mapping omits keeps the default.
export type FinishPrimitivePlan = {
  readonly mesh: number
  readonly primitive: number
  readonly defaultMaterial: number | null
  readonly variantMaterials: ReadonlyMap<number, number>
}

export type FinishPlan = {
  // The variant names in declaration order; a name's position is its index.
  readonly variants: readonly string[]
  // One entry per mesh primitive that names a material or carries a mapping.
  readonly primitives: readonly FinishPrimitivePlan[]
  // Every material index the plan names, defaults included: the set a load
  // must resolve before any switch can apply them without loading.
  readonly materialIndexes: ReadonlySet<number>
}

// Reads the finish plan from a parser JSON, or fails with one
// FinishPlanError listing every mapping problem the file has. The class of
// files it covers: a file without the extension (no variants, every
// primitive keeps its default), a primitive without a mapping (every
// variant keeps its default), a mapping per variant, and one material
// shared by all the variants of a primitive.
export function readFinishPlan(json: unknown): FinishPlan {
  const problems: FinishProblem[] = []
  validateVariantsTable(json, problems)
  if (problems.length > 0) {
    throw new FinishPlanError(problems)
  }
  const variants = readVariantNames(json)
  const meshes = readJsonKey(json, 'meshes')
  if (!Array.isArray(meshes)) {
    return { variants, primitives: [], materialIndexes: new Set() }
  }

  const materials = readJsonKey(json, 'materials')
  const materialCount = Array.isArray(materials) ? materials.length : 0
  const primitives: FinishPrimitivePlan[] = []
  const materialIndexes = new Set<number>()
  meshes.forEach((mesh, meshIndex) => {
    const meshPrimitives = readJsonKey(mesh, 'primitives')
    if (!Array.isArray(meshPrimitives)) {
      return
    }
    meshPrimitives.forEach((primitive, primitiveIndex) => {
      readPrimitivePlan(primitive, meshIndex, primitiveIndex, materialCount, variants.length, {
        problems,
        primitives,
        materialIndexes,
      })
    })
  })
  if (problems.length > 0) {
    throw new FinishPlanError(problems)
  }
  return { variants, primitives, materialIndexes }
}

// The variants table must be readable as a whole before any name is used:
// a malformed entry would shift the indexes every mapping refers to, so it
// is a problem of its own instead of a silent drop.
function validateVariantsTable(json: unknown, problems: FinishProblem[]): void {
  const entries = readJsonKey(
    readJsonKey(readJsonKey(json, 'extensions'), VARIANTS_EXTENSION),
    'variants',
  )
  if (entries === undefined) {
    return
  }
  if (!Array.isArray(entries)) {
    problems.push({ mesh: null, primitive: null, message: 'the variants table is not a list' })
    return
  }
  entries.forEach((entry, index) => {
    const name =
      typeof entry === 'object' && entry !== null ? readJsonKey(entry, 'name') : undefined
    if (typeof name !== 'string') {
      problems.push({ mesh: null, primitive: null, message: `the variant at ${index} has no name` })
    }
  })
}

// What one primitive's read writes into: the shared problem list, the plan
// being built, and the problem maker that names the mesh and primitive.
type PrimitivePlanInput = {
  readonly at: (message: string) => FinishProblem
  readonly variantCount: number
  readonly materialCount: number
  problems: FinishProblem[]
  primitives: FinishPrimitivePlan[]
  materialIndexes: Set<number>
}

// Reads one mesh primitive's finish facts into the plan, reporting every
// mapping problem by the mesh and primitive it sits on. A primitive that
// names no material and carries no mapping has no finish facts to plan.
function readPrimitivePlan(
  primitive: unknown,
  meshIndex: number,
  primitiveIndex: number,
  materialCount: number,
  variantCount: number,
  output: Pick<PrimitivePlanInput, 'problems' | 'primitives' | 'materialIndexes'>,
): void {
  if (typeof primitive !== 'object' || primitive === null) {
    return
  }
  const at = (message: string): FinishProblem => ({
    mesh: meshIndex,
    primitive: primitiveIndex,
    message,
  })
  const material = readJsonKey(primitive, 'material')
  const defaultMaterial = typeof material === 'number' ? material : null
  const variantMaterials = readVariantMaterials(
    { at, variantCount, materialCount, ...output },
    primitive,
  )
  if (defaultMaterial === null && variantMaterials.size === 0) {
    return
  }
  if (defaultMaterial !== null) {
    output.materialIndexes.add(defaultMaterial)
  }
  for (const materialIndex of variantMaterials.values()) {
    output.materialIndexes.add(materialIndex)
  }
  output.primitives.push({
    mesh: meshIndex,
    primitive: primitiveIndex,
    defaultMaterial,
    variantMaterials,
  })
}

// The mapping table of one primitive, read into its variant table: each
// mapping contributes its problems and its variant to material pairs.
function readVariantMaterials(input: PrimitivePlanInput, primitive: unknown): Map<number, number> {
  const variantMaterials = new Map<number, number>()
  const mappings = readJsonKey(
    readJsonKey(readJsonKey(primitive, 'extensions'), VARIANTS_EXTENSION),
    'mappings',
  )
  if (!Array.isArray(mappings)) {
    return variantMaterials
  }
  mappings.forEach((mapping, mappingIndex) => {
    const material = readMappingMaterial(input, mapping, mappingIndex)
    if (material !== null) {
      readMappingVariants(input, mapping, mappingIndex, material, variantMaterials)
    }
  })
  return variantMaterials
}

// The material index one mapping dresses its variants with, or null when
// the problem is reported.
function readMappingMaterial(
  input: PrimitivePlanInput,
  mapping: unknown,
  mappingIndex: number,
): number | null {
  if (typeof mapping !== 'object' || mapping === null) {
    input.problems.push(input.at(`the mapping at ${mappingIndex} is not an object`))
    return null
  }
  const material = readJsonKey(mapping, 'material')
  if (typeof material !== 'number' || !Number.isInteger(material) || material < 0) {
    input.problems.push(input.at(`the mapping at ${mappingIndex} names no material`))
    return null
  }
  if (material >= input.materialCount) {
    input.problems.push(
      input.at(
        `the mapping at ${mappingIndex} names material ${material}, the file carries ${input.materialCount}`,
      ),
    )
    return null
  }
  return material
}

// The variants one mapping names, taken into the primitive's table. A
// mapping with a repeated entry reports it once.
function readMappingVariants(
  input: PrimitivePlanInput,
  mapping: object,
  mappingIndex: number,
  material: number,
  variantMaterials: Map<number, number>,
): void {
  const mappedVariants = readJsonKey(mapping, 'variants')
  if (!Array.isArray(mappedVariants) || mappedVariants.length === 0) {
    input.problems.push(input.at(`the mapping at ${mappingIndex} names no variant`))
    return
  }
  let taken = false
  mappedVariants.forEach((variant) => {
    if (taken) {
      return
    }
    if (!isVariantIndex(variant, input.variantCount)) {
      input.problems.push(
        input.at(unknownVariantMessage(mappingIndex, variant, input.variantCount)),
      )
      return
    }
    if (variantMaterials.has(variant)) {
      taken = true
      input.problems.push(
        input.at(`the mapping at ${mappingIndex} names variant ${variant} a second time`),
      )
      return
    }
    variantMaterials.set(variant, material)
  })
}

function isVariantIndex(variant: unknown, variantCount: number): variant is number {
  return (
    typeof variant === 'number' &&
    Number.isInteger(variant) &&
    variant >= 0 &&
    variant < variantCount
  )
}

function unknownVariantMessage(
  mappingIndex: number,
  variant: unknown,
  variantCount: number,
): string {
  return typeof variant === 'number' && Number.isInteger(variant) && variant >= 0
    ? `the mapping at ${mappingIndex} names variant ${variant}, the file declares ${variantCount}`
    : `the mapping at ${mappingIndex} names the malformed variant ${String(variant)}`
}
