import type { ProductCollection } from '../product'

// The products whose model bytes the stage fetches ahead: the collection's
// previous and next neighbors of the product that last came to rest (the
// switch state's rested product), each
// once and never the rested product itself (a one-product collection is its
// own neighbor, a two-product one has the same product on both sides). None
// before a first rest, so nothing is fetched ahead of the product the visitor
// is waiting for. The list holds through a running sequence, so a neighbor's
// bytes are still there when the swap reaches it.
export function preloadSlugs(
  rested: string | null,
  collection: ProductCollection,
): readonly string[] {
  if (rested === null) {
    return []
  }
  const neighbors = collection.neighbors(rested)
  if (neighbors === undefined) {
    throw new Error(`the collection holds no product '${rested}'`)
  }
  const slugs = new Set([neighbors.previous.slug, neighbors.next.slug])
  slugs.delete(rested)
  return [...slugs]
}
