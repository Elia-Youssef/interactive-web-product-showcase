// The validate step's checks: what a shipped product must satisfy, one
// check group per rule of the Blender contract and of the loading and
// performance budgets.
// Every group is a pure function over facts: the parsed manifest, the
// structure of the model, and the model's sizes. Each group reports every
// violation it finds, never only the first.
//
// The product domain is reached through types only: a plain Node run can
// resolve no src import (they are extensionless for the browser bundle), so
// the rule assembly crosses the boundary through scripts/manifestIo.ts; the
// camera modules that import nothing at runtime (the authored data, the
// frame function) are imported here natively.
import type { Product } from '../src/lib/product/index.ts'
import { HOTSPOT_PREFIX, PART_PREFIX } from '../src/lib/product/contractNames.ts'
import { DRAW_CALLS_MAX, MODEL_BUDGET_BYTES, TEXTURE_MAX_SIZE_PX } from './budgets.ts'
import { budgetShare, formatBytes, type TextureReport } from './report.ts'
import { describeParent, findExplodeClipViolations, type ProductStructure } from './structure.ts'

export type CheckStatus = 'pass' | 'fail' | 'skipped'

export type CheckResult = {
  name: string
  status: CheckStatus
  // What the group saw, pass or fail: the fact the check measured.
  detail: string
  violations: readonly string[]
  warnings: readonly string[]
}

// A group that ran: it fails when it found violations, and it can carry
// warnings while still passing (a warning never fails the gate).
export function checkResult(
  name: string,
  detail: string,
  violations: readonly string[],
  warnings: readonly string[] = [],
): CheckResult {
  return {
    name,
    status: violations.length > 0 ? 'fail' : 'pass',
    detail,
    violations,
    warnings,
  }
}

// A group that could not run: the report shows why, and the group raises
// no violation of its own (the missing input carries them).
export function skippedCheck(name: string, reason: string): CheckResult {
  return { name, status: 'skipped', detail: `skipped: ${reason}`, violations: [], warnings: [] }
}

// The texture facts the encoding and budget checks read: the label a
// report line names, the image mime type, and the pixel dimensions (null
// when unreadable). A full TextureReport satisfies this by structure.
export type TextureFact = Pick<TextureReport, 'label' | 'mimeType' | 'dimensions'>

export type EncodingFacts = {
  textures: readonly TextureFact[]
  meshoptCompressed: boolean
}

export type BudgetFacts = {
  fileBytes: number
  textures: readonly TextureFact[]
  drawCalls: number
}

// The validate step's result for one product: one entry per check group,
// in the report's order.
export type ProductValidation = {
  slug: string
  checks: readonly CheckResult[]
}

export function countViolations(validation: ProductValidation): number {
  return validation.checks.reduce((sum, check) => sum + check.violations.length, 0)
}

export function countWarnings(validation: ProductValidation): number {
  return validation.checks.reduce((sum, check) => sum + check.warnings.length, 0)
}

// The manifest names this product: its slug must be the folder's name.
export function checkManifest(slug: string, manifest: Product): CheckResult {
  const violations: string[] = []
  if (manifest.slug !== slug) {
    violations.push(`manifest slug '${manifest.slug}' does not match the product folder '${slug}'`)
  }
  return checkResult('manifest', `slug '${manifest.slug}'`, violations)
}

// Every manifest hotspot needs its HS_<id> node, parented by nearest named
// ancestor to a PART_ node, so the hotspot rides along in the exploded
// view.
export function checkHotspots(manifest: Product, structure: ProductStructure): CheckResult {
  const violations: string[] = []
  const anchorsByName = new Map(structure.hotspotAnchors.map((anchor) => [anchor.name, anchor]))
  for (const hotspot of manifest.hotspots) {
    const anchor = anchorsByName.get(`${HOTSPOT_PREFIX}${hotspot.id}`)
    if (anchor === undefined) {
      violations.push(`no ${HOTSPOT_PREFIX}${hotspot.id} node for manifest hotspot '${hotspot.id}'`)
      continue
    }
    if (anchor.parentName === null || !anchor.parentName.startsWith(PART_PREFIX)) {
      violations.push(
        `hotspot ${HOTSPOT_PREFIX}${hotspot.id} is parented to ${describeParent(anchor.parentName)}, ` +
          `expected a ${PART_PREFIX} node`,
      )
    }
  }
  return checkResult('hotspots', `${manifest.hotspots.length} manifest hotspots`, violations)
}

// The model contract: the geometry classes the site can present. A
// product's meshes are triangle primitives with positions, with no morph
// targets, no skins and no instancing, in one scene holding every node:
// the classes the runtime frame measure and the document facts read the
// same way. Anything else diverges silently between the build-time facts
// and the loaded scene, so it fails the build by name instead.
export function checkGeometry(structure: ProductStructure): CheckResult {
  const violations: string[] = []
  const geometry = structure.geometry
  if (geometry.primitivesNotTriangles > 0) {
    violations.push(
      `${geometry.primitivesNotTriangles} of ${geometry.primitives} primitives are not triangles`,
    )
  }
  if (geometry.primitivesWithoutPosition > 0) {
    violations.push(
      `${geometry.primitivesWithoutPosition} of ${geometry.primitives} primitives carry no positions`,
    )
  }
  if (geometry.primitivesWithMorphTargets > 0) {
    violations.push(
      `${geometry.primitivesWithMorphTargets} of ${geometry.primitives} primitives carry morph targets`,
    )
  }
  if (geometry.skins > 0) {
    violations.push(`the model carries ${geometry.skins} skins`)
  }
  if (geometry.gpuInstancing) {
    violations.push('the model carries EXT_mesh_gpu_instancing')
  }
  if (geometry.scenes !== 1) {
    violations.push(`expected exactly one scene, found ${geometry.scenes}`)
  }
  for (const name of geometry.nodeNamesOutsideScene) {
    violations.push(`node ${name} sits outside the scene`)
  }
  const detail =
    `${geometry.primitives} primitives, ${geometry.skins} skins, ` +
    (geometry.gpuInstancing ? 'EXT_mesh_gpu_instancing present' : 'no instancing')
  return checkResult('geometry', detail, violations)
}

// Finishes are the pairing of manifest and KHR_materials_variants, in both
// directions: a manifest finish with no variant cannot be shown, and a
// variant with no manifest finish could never appear on the site.
export function checkFinishes(manifest: Product, structure: ProductStructure): CheckResult {
  const violations: string[] = []
  const manifestVariants = manifest.finishes.map((finish) => finish.variant)
  for (const variant of manifestVariants) {
    if (!structure.variantNames.includes(variant)) {
      violations.push(`manifest finish has no matching variant: '${variant}'`)
    }
  }
  for (const variant of structure.variantNames) {
    if (!manifestVariants.includes(variant)) {
      violations.push(`variant has no manifest finish: '${variant}'`)
    }
  }
  const detail =
    structure.variantNames.length === 0
      ? 'no variants'
      : `variants ${structure.variantNames.join(', ')}`
  return checkResult('finishes', detail, violations)
}

// Exactly one animation, named by the clip the parsed manifest carries.
// The schema normalizes the explode block, so the clip is always there and
// this group repeats no default.
export function checkExplode(manifest: Product, structure: ProductStructure): CheckResult {
  const clip = manifest.explode.clip
  return checkResult('explode', `clip '${clip}'`, findExplodeClipViolations(structure, clip))
}

// The optimize step's marks: every image KTX2-encoded, geometry Meshopt
// compressed. A file without them would ship megabytes of PNG and draw
// through the uncompressed path.
export function checkEncoding(facts: EncodingFacts): CheckResult {
  const violations: string[] = []
  for (const texture of facts.textures) {
    if (texture.mimeType !== 'image/ktx2') {
      violations.push(`texture '${texture.label}' is ${texture.mimeType}, expected image/ktx2`)
    }
  }
  if (!facts.meshoptCompressed) {
    violations.push('no EXT_meshopt_compression: the optimize step did not run')
  }
  const detail =
    `${facts.textures.length} textures, ` +
    (facts.meshoptCompressed ? 'EXT_meshopt_compression present' : 'no EXT_meshopt_compression')
  return checkResult('encoding', detail, violations)
}

// The pixel edge of one texture: the larger of its two dimensions. The
// caller reports an unreadable size as its own violation before this runs.
function edgePx(dimensions: readonly [number, number]): number {
  return Math.max(...dimensions)
}

export function checkBudgets(facts: BudgetFacts): CheckResult {
  const violations: string[] = []
  let largestEdge: number | null = null
  for (const texture of facts.textures) {
    const dimensions = texture.dimensions
    if (dimensions === null) {
      violations.push(`texture '${texture.label}' has no readable size`)
      continue
    }
    const edge = edgePx(dimensions)
    if (edge > TEXTURE_MAX_SIZE_PX) {
      violations.push(
        `texture '${texture.label}' is ${dimensions[0]}x${dimensions[1]} px, ` +
          `over the ${TEXTURE_MAX_SIZE_PX} px texture edge budget`,
      )
    }
    if (largestEdge === null || edge > largestEdge) {
      largestEdge = edge
    }
  }
  if (facts.fileBytes > MODEL_BUDGET_BYTES) {
    violations.push(
      `file size ${formatBytes(facts.fileBytes)} exceeds the ` +
        `${formatBytes(MODEL_BUDGET_BYTES)} model budget`,
    )
  }
  if (facts.drawCalls > DRAW_CALLS_MAX) {
    violations.push(`draw calls ${facts.drawCalls} exceed the ${DRAW_CALLS_MAX} draw call budget`)
  }
  const detail =
    `${formatBytes(facts.fileBytes)} of ${formatBytes(MODEL_BUDGET_BYTES)} ` +
    `(${budgetShare(facts.fileBytes)}), ` +
    (largestEdge === null ? 'no textures' : `largest texture edge ${largestEdge} px`) +
    `, ${facts.drawCalls} draw calls of ${DRAW_CALLS_MAX}`
  return checkResult('budgets', detail, violations)
}
