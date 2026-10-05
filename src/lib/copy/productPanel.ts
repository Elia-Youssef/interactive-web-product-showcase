import type { Product } from '../product'
import { siteCopy } from './site'

// The finish one swatch of the panel carries.
export type PanelFinish = Product['finishes'][number]

// The exploded view toggle's label: the manifest's own word, or the site's
// while the manifest names none.
export function explodeToggleLabel(product: Product): string {
  return product.explode.label ?? siteCopy.defaultExplodeLabel
}

// The exploded view's progress as a whole percent, '0%' to '100%'. The
// rounding is the display's: the scrub readout and the slider's value text
// both call this one function, so they can never disagree.
export function formatExplodePercent(progress: number): string {
  return `${Math.round(progress * 100)}%`
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
