import { test } from './fixtures'
import { requireHotspotProducts, selectHotspotProducts } from './hotspotProducts'

// Keep an executable failure even when selection would register no tests.
// Nonempty suites verify the same requirement before running their proofs.
export function hotspotTestProducts<Item extends { readonly hotspots: readonly unknown[] }>(
  products: readonly Item[],
  proof: string,
): readonly Item[] {
  const selected = selectHotspotProducts(products)
  const requireProducts = () => {
    requireHotspotProducts(products, proof)
  }
  registerRuntimeRequirement(
    `${proof}: requires products with hotspots`,
    selected.length,
    requireProducts,
  )
  return selected
}

export function registerRuntimeRequirement(
  name: string,
  subjectCount: number,
  requirement: () => void,
): void {
  if (subjectCount === 0) {
    test(name, requirement)
  } else {
    test.beforeAll(requirement)
  }
}
