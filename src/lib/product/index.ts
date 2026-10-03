// Public API of the product domain module. Everything else in this folder is
// internal and may only be reached through this file.

export {
  CAMERA_HOME_ID,
  CAMERA_PREFIX,
  HOTSPOT_PREFIX,
  PART_PREFIX,
  SHADOW_NODE_NAME,
} from './contractNames'
export { productManifestSchema, productLookSchema } from './schema'
export type { Product, ProductInput, ProductLookBlock } from './schema'
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
export { closeUpHotspotIds } from './rigSummary'
export type { ProductClipSummary, ProductHotspotSummary, ProductRigSummary } from './rigSummary'
export {
  FinishPlanError,
  finishEntryMaterialIndexes,
  readFinishPlan,
  readJsonKey,
  readVariantNames,
} from './variants'
export type { FinishPlan, FinishPrimitivePlan, FinishProblem } from './variants'
export {
  finishDerivedKey,
  finishMaterialIndex,
  finishPrimitiveKey,
  mappedFinishEntries,
  prescribesMaterial,
  precompilePairs,
} from './finishPlanQueries'
