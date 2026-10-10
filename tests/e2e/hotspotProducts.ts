type HotspotProduct = { readonly hotspots: readonly unknown[] }

// Selection is total at collection. The requirement is checked by a test
// or hook at run time, so an empty set cannot prevent other specs loading.
export function selectHotspotProducts<Item extends HotspotProduct>(
  products: readonly Item[],
): readonly Item[] {
  return products.filter((product) => product.hotspots.length > 0)
}

export function requireHotspotProducts<Item extends HotspotProduct>(
  products: readonly Item[],
  proof: string,
): readonly [Item, ...Item[]] {
  const [first, ...rest] = selectHotspotProducts(products)
  if (first === undefined) {
    throw new Error(`${proof}: the product set carries no product with hotspots`)
  }
  return [first, ...rest]
}
