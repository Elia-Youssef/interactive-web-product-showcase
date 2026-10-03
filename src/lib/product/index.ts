// Public API of the product domain module. Everything else in this folder is
// internal and may only be reached through this file.

export {
  CAMERA_HOME_ID,
  CAMERA_PREFIX,
  HOTSPOT_PREFIX,
  PART_PREFIX,
  SHADOW_NODE_NAME,
} from './contractNames'
export { productCameraSchema, productManifestSchema, productLookSchema } from './schema'
export type { Product, ProductCameraBlock, ProductInput, ProductLookBlock } from './schema'
export { HOTSPOT_BULLETS_MAX } from './rules'
export { parseProduct } from './parse'
export { resolveProductLook } from './resolveLook'
export type { ProductLookValues } from './resolveLook'
export { CollectionError, ManifestError } from './errors'
export type { CollectionProblem, ProductIssue } from './errors'
export { createCollection } from './collection'
export type { ProductCollection, ProductNeighbors } from './collection'
export { productModelUrl } from './modelUrl'
export type { ProductModelCounts } from './modelCounts'
export { basisTranscoderPath } from './transcoderPath'
export type { ProductClipSummary, ProductHotspotSummary, ProductRigSummary } from './rigSummary'
export type { RigProblem } from './rigProblem'
export type { ProductFailure, ProductFailureKind } from './failure'
export {
  finishEntryMaterialIndexes,
  readFinishPlan,
  readJsonKey,
  readVariantNames,
} from './variants'
export type { FinishPlan, FinishPlanRead, FinishPrimitivePlan, FinishProblem } from './variants'
export {
  finishDerivedKey,
  finishMaterialIndex,
  finishPrimitiveKey,
  mappedFinishEntries,
  prescribesMaterial,
  precompilePairs,
} from './finishPlanQueries'
