import type { ProductLookValues } from '@lib/product'

// The stage's look defaults: what a product without a look block gets, what
// a partial block is filled up with, and what the renderer and scene return
// to when the product leaves. The units are in the names.
export const lookDefaults: ProductLookValues = {
  exposure: 1,
  environmentIntensity: 1,
  environmentRotationDeg: 0,
  shadowOpacity: 1,
}
