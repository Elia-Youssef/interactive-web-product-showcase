// Public API of the variants feature: the finish controller that applies a
// product's selected finish to its model, and the one offer hook every
// composition with finish controls shares. The compositions mount the
// controller as a child of Product and call the hook beside their finish
// controls.

export { ProductFinishes } from './ProductFinishes'
export { useFinishOffer } from './useFinishOffer'
