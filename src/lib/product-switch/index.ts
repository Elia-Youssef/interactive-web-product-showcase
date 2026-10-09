// Public API of the product switch sequence. Everything else in this folder
// is internal and may only be reached through this file.

export { applyProductSwitchEvent, initialProductSwitch } from './machine'
export type {
  ProductSettleOutcome,
  ProductSwitchEvent,
  ProductSwitchState,
  ShownProduct,
} from './machine'
export { preloadSlugs } from './preload'
