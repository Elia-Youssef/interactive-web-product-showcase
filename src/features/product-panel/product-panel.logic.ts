import type { Product } from '@lib/product'

// The finish one swatch of the panel carries.
export type PanelFinish = Product['finishes'][number]

// The collection position as a two-digit index:
// 1 becomes '01'. Display formatting stays in the display layer.
export function formatProductIndex(number: number): string {
  return String(number).padStart(2, '0')
}

// The finish the panel shows as active: the variant the store selected, or
// the product default, its first finish, while nothing is selected. A
// selected variant the product does not offer is a programming error and
// throws, like the store slice does; the manifest schema guarantees at
// least one finish, so the empty list throws for the same reason.
export function activeFinish(product: Product, selectedVariant: string | null): PanelFinish {
  if (selectedVariant !== null) {
    const selected = product.finishes.find((finish) => finish.variant === selectedVariant)
    if (selected === undefined) {
      throw new Error(
        `the product '${product.slug}' does not offer the selected finish '${selectedVariant}'`,
      )
    }
    return selected
  }
  const first = product.finishes[0]
  if (first === undefined) {
    throw new Error(`the product '${product.slug}' offers no finishes`)
  }
  return first
}
