// Public API of the product domain module. Everything else in this folder is
// internal and may only be reached through this file.

export {
  CAMERA_HOME_ID,
  CAMERA_PREFIX,
  HOTSPOT_PREFIX,
  PART_PREFIX,
  SHADOW_NODE_NAME,
} from './contractNames'
export {
  productCameraSchema,
  productManifestSchema,
  productLookSchema,
  productMetaSchema,
} from './schema'
export type {
  Product,
  ProductCameraBlock,
  ProductInput,
  ProductLookBlock,
  ProductMetaBlock,
} from './schema'
export { HOTSPOT_BULLETS_MAX } from './rules'
export { parseProduct } from './parse'
export { resolveProductLook } from './resolveLook'
export type { ProductLookValues } from './resolveLook'
export { CollectionError, ManifestError } from './errors'
export type { CollectionProblem, ProductIssue } from './errors'
export { createCollection } from './collection'
export type { ProductCollection, ProductNeighbors } from './collection'
export {
  productName,
  formatProductIndex,
  formatProductCounter,
  formatProductSerial,
  productEyebrow,
  productEyebrowText,
  stepLabel,
} from './format'
export { productModelUrl } from './modelUrl'
export type { ProductModelCounts } from './modelCounts'
export { closeUpHotspotIds } from './rigSummary'
export type { ProductClipSummary, ProductHotspotSummary, ProductRigSummary } from './rigSummary'
export type { RigProblem } from './rigProblem'
export {
  duplicateNodeNameMessage,
  unknownMappingMaterialMessage,
  unknownMappingVariantMessage,
} from './contractDiagnostics'
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
