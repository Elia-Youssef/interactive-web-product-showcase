// The storage bound the contract's first-key rule is stated in: how far
// the meshopt EXPONENTIAL filter the writer applies to translation outputs
// can move one stored key component, at the pipeline's key bits. Computed
// from the filter's own form, never picked.

import { KEY_FILTER_BITS } from './settings.ts'

// How far one component of a stored translation key can sit from the value
// it was authored from: the meshopt EXPONENTIAL filter's step at the
// pipeline's key bits, over the key's own largest component. The filter
// stores a key as an integer mantissa over one shared exponent chosen so
// the key's largest component fits the 12 signed bits, so no component of
// the key moves by more than 2^-(bits-1) of that largest magnitude. The
// installed encoder's round trip, over keys at magnitudes from 2^-25 to 1,
// comes within a percent of the bound and never past it
// (storageBounds.test.ts holds it there).
export function translationKeyComponentBound(keyComponents: readonly number[]): number {
  if (keyComponents.length === 0) {
    throw new Error('a translation key carries at least one component')
  }
  const largest = Math.max(...keyComponents.map((component) => Math.abs(component)))
  return Math.pow(2, 1 - KEY_FILTER_BITS) * largest
}
