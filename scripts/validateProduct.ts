// Validates one shipped product: loads its manifest and its model, runs
// every check group, and reports what was checked with every violation.
// Each input is loaded independently, so a product with a broken manifest
// still gets its model checks, and the other way around.
import type { Document, NodeIO } from '@gltf-transform/core'
import { readContractModelFacts } from './contractFacts.ts'
import type { ContractModelFacts } from './contractFacts.ts'
import { runContractRules, withRuleMessages } from './contractRules.ts'
import { countDrawCalls } from './drawCalls.ts'
import { readHomeFitFacts } from './homeFitFacts.ts'
import type { HomeFitFacts } from './homeFitFacts.ts'
import { createModelIO } from './modelIo.ts'
import type { ParseProduct } from './manifestIo.ts'
import { loadCameraContract, readManifestFile } from './manifestIo.ts'
import type { CameraContract } from './manifestIo.ts'
import { pipelinePositionGrid } from './storageGrid.ts'
import { readPositionStorage, readTranslationOutputs } from './storageFacts.ts'
import type { StorageFacts } from './storageFacts.ts'
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
  checkMaterials,
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

// The model facts of one product side, as the load answers them: every
// fact null when the model never loaded, so the contract groups skip for
// want of their input.
type ModelSide = {
  readonly check: CheckResult
  readonly structure: ProductStructure | null
  readonly facts: ContractModelFacts | null
  readonly homeFit: HomeFitFacts | null
  readonly storage: StorageFacts | null
  readonly fileBytes: number | null
  readonly textures: readonly TextureFact[]
  readonly drawCalls: number | null
}

// The model side when the file is missing or unreadable: the load's own
// violation, and every fact null.
function unreadableModel(detail: string, violation: string, fileBytes: number | null): ModelSide {
  return {
    check: checkResult('model', detail, [violation]),
    structure: null,
    facts: null,
    homeFit: null,
    storage: null,
    fileBytes,
    textures: [],
    drawCalls: null,
  }
}

// The model side: the file exists, reads back, and yields the facts every
// model check reads: the structure, the contract and home-fit facts, the
// storage facts (the position storage from the read-back document, the
// translation outputs from the file's own glTF JSON and binary chunk), the
// texture reports and the draw-call count. A
// missing or unreadable model is this group's violation; the model check
// groups then skip for want of their input.
async function loadModel(io: NodeIO, root: string, paths: ProductPaths): Promise<ModelSide> {
  const shown = repoPath(root, paths.modelGlb)
  const fileBytes = await fileSizeBytes(paths.modelGlb)
  if (fileBytes === null) {
    return unreadableModel(`expected ${shown}`, `model missing: expected ${shown}`, null)
  }
  let doc: Document
  try {
    doc = await io.read(paths.modelGlb)
  } catch (error) {
    return unreadableModel(shown, `could not read ${shown}: ${reasonOf(error)}`, fileBytes)
  }
  const structure = readProductStructure(doc)
  return {
    check: checkResult('model', `${shown} (${formatBytes(fileBytes)})`, []),
    structure,
    facts: readContractModelFacts(doc),
    homeFit: readHomeFitFacts(doc, structure.animationChannels),
    storage: await readStorageFacts(io, paths.modelGlb, doc),
    fileBytes,
    textures: describeTextures(doc),
    drawCalls: countDrawCalls(doc),
  }
}

// The storage facts of one written model: the position storage from the
// read-back document, held against the pipeline's quantize grid, and the
// translation outputs from the file's own glTF JSON and binary chunk.
async function readStorageFacts(
  io: NodeIO,
  modelPath: string,
  doc: Document,
): Promise<StorageFacts> {
  return {
    positions: readPositionStorage(doc, await pipelinePositionGrid()),
    translationOutputs: await readTranslationOutputs(io, modelPath),
  }
}

// The contract groups of one product: the rule table's findings folded
// into each group's own check, or the groups skipped for want of their
// input. The model group's entry is replaced in place, ahead of the
// groups that follow it in the report.
function contractChecks(
  manifestSide: Awaited<ReturnType<typeof loadManifest>>,
  modelSide: Awaited<ReturnType<typeof loadModel>>,
  contract: CameraContract,
): CheckResult[] {
  const manifest = manifestSide.manifest
  const structure = modelSide.structure
  if (
    manifest !== null &&
    structure !== null &&
    modelSide.facts !== null &&
    modelSide.homeFit !== null &&
    modelSide.storage !== null
  ) {
    const findings = runContractRules({
      manifest,
      structure,
      facts: modelSide.facts,
      homeFit: modelSide.homeFit,
      storage: modelSide.storage,
      contract,
    })
    return [
      withRuleMessages(modelSide.check, findings, 'model'),
      checkHotspots(manifest, structure),
      withRuleMessages(checkCameras(manifest, structure, contract), findings, 'cameras'),
      withRuleMessages(checkGeometry(structure), findings, 'geometry'),
      withRuleMessages(checkFinishes(manifest, structure), findings, 'finishes'),
      withRuleMessages(checkMaterials(structure), findings, 'materials'),
      withRuleMessages(checkExplode(manifest, structure), findings, 'explode'),
    ]
  }
  const reason = manifest === null ? 'the manifest did not load' : 'the model did not read'
  return [
    modelSide.check,
    skippedCheck('hotspots', reason),
    skippedCheck('cameras', reason),
    skippedCheck('geometry', reason),
    skippedCheck('finishes', reason),
    skippedCheck('materials', reason),
    skippedCheck('explode', reason),
  ]
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
  const checks: CheckResult[] = [
    manifestSide.check,
    ...contractChecks(manifestSide, modelSide, contract),
  ]

  const structure = modelSide.structure
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
