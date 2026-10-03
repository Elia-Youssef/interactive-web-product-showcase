// Validates one shipped product: loads its manifest and its model, runs
// every check group, and reports what was checked with every violation.
// Each input is loaded independently, so a product with a broken manifest
// still gets its model checks, and the other way around.
import type { NodeIO } from '@gltf-transform/core'
import { countDrawCalls } from './drawCalls.ts'
import { createModelIO } from './modelIo.ts'
import type { ParseProduct } from './manifestIo.ts'
import { loadCameraContract, readManifestFile } from './manifestIo.ts'
import { productPaths, repoPath, type ProductPaths } from './productPaths.ts'
import { describeTextures, fileSizeBytes, formatBytes } from './report.ts'
import { readProductStructure, type ProductStructure } from './structure.ts'
import {
  checkBudgets,
  checkEncoding,
  checkExplode,
  checkFinishes,
  checkGeometry,
  checkHotspots,
  checkManifest,
  checkResult,
  skippedCheck,
  type BudgetFacts,
  type CheckResult,
  type EncodingFacts,
  type ProductValidation,
  type TextureFact,
} from './validateChecks.ts'
import { checkCameras } from './validateCameras.ts'

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// The manifest side: the file loads, parseProduct validates it (its errors
// name the fields), and the slug must match the folder. A manifest that
// never loads or parses is this group's violation; the contract groups
// then skip for want of their input. Report lines carry the repo-relative
// path; the loader keeps the absolute one.
async function loadManifest(
  root: string,
  paths: ProductPaths,
  parseProduct: ParseProduct,
): Promise<{ check: CheckResult; manifest: ReturnType<ParseProduct> | null }> {
  const shown = repoPath(root, paths.manifestFile)
  const load = await readManifestFile(paths.manifestFile)
  if (load.kind === 'missing') {
    return {
      check: checkResult('manifest', `expected ${shown}`, [`manifest missing: expected ${shown}`]),
      manifest: null,
    }
  }
  if (load.kind === 'noManifestExport') {
    return {
      check: checkResult('manifest', shown, [`no 'manifest' export in ${shown}`]),
      manifest: null,
    }
  }
  if (load.kind === 'error') {
    return {
      check: checkResult('manifest', shown, [`could not load ${shown}: ${load.reason}`]),
      manifest: null,
    }
  }
  let manifest: ReturnType<ParseProduct>
  try {
    manifest = parseProduct(load.manifest, paths.manifestFile)
  } catch (error) {
    return {
      check: checkResult('manifest', `does not parse: ${shown}`, [reasonOf(error)]),
      manifest: null,
    }
  }
  return { check: checkManifest(paths.slug, manifest), manifest }
}

// The model side: the file exists, reads back, and yields the facts every
// model check reads: the structure, the texture reports and the draw-call
// count. A missing or unreadable model is this group's violation; the
// model check groups then skip for want of their input.
async function loadModel(
  io: NodeIO,
  root: string,
  paths: ProductPaths,
): Promise<{
  check: CheckResult
  structure: ProductStructure | null
  fileBytes: number | null
  textures: readonly TextureFact[]
  drawCalls: number | null
}> {
  const shown = repoPath(root, paths.modelGlb)
  const fileBytes = await fileSizeBytes(paths.modelGlb)
  if (fileBytes === null) {
    return {
      check: checkResult('model', `expected ${shown}`, [`model missing: expected ${shown}`]),
      structure: null,
      fileBytes: null,
      textures: [],
      drawCalls: null,
    }
  }
  let doc
  try {
    doc = await io.read(paths.modelGlb)
  } catch (error) {
    return {
      check: checkResult('model', shown, [`could not read ${shown}: ${reasonOf(error)}`]),
      structure: null,
      fileBytes,
      textures: [],
      drawCalls: null,
    }
  }
  return {
    check: checkResult('model', `${shown} (${formatBytes(fileBytes)})`, []),
    structure: readProductStructure(doc),
    fileBytes,
    textures: describeTextures(doc),
    drawCalls: countDrawCalls(doc),
  }
}

export async function validateShippedProduct(
  root: string,
  slug: string,
  parseProduct: ParseProduct,
): Promise<ProductValidation> {
  const io = await createModelIO()
  const paths = productPaths(root, slug)
  const contract = await loadCameraContract()
  const manifestSide = await loadManifest(root, paths, parseProduct)
  const modelSide = await loadModel(io, root, paths)
  const checks: CheckResult[] = [manifestSide.check, modelSide.check]

  const manifest = manifestSide.manifest
  const structure = modelSide.structure
  if (manifest !== null && structure !== null) {
    checks.push(
      checkHotspots(manifest, structure),
      checkCameras(manifest, structure, contract),
      checkGeometry(structure),
      checkFinishes(manifest, structure),
      checkExplode(manifest, structure),
    )
  } else {
    const reason = manifest === null ? 'the manifest did not load' : 'the model did not read'
    checks.push(
      skippedCheck('hotspots', reason),
      skippedCheck('cameras', reason),
      skippedCheck('geometry', reason),
      skippedCheck('finishes', reason),
      skippedCheck('explode', reason),
    )
  }

  if (structure !== null && modelSide.fileBytes !== null && modelSide.drawCalls !== null) {
    const encodingFacts: EncodingFacts = {
      textures: modelSide.textures,
      meshoptCompressed: structure.meshoptCompressed,
    }
    const budgetFacts: BudgetFacts = {
      fileBytes: modelSide.fileBytes,
      textures: modelSide.textures,
      drawCalls: modelSide.drawCalls,
    }
    checks.push(checkEncoding(encodingFacts), checkBudgets(budgetFacts))
  } else {
    checks.push(skippedCheck('encoding', 'the model did not read'))
    checks.push(skippedCheck('budgets', 'the model did not read'))
  }

  return { slug, checks }
}
