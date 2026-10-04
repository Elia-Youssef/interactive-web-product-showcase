import type { Product } from './schema'

// The display formatting of the product domain: the words and indexes the
// UI shows for a product. Rounding and shaping for display live here, one
// definition per string, so every reader shows the same form.

// A product's own name: the brand and the model, as the panel title and
// the document title show it.
export function productName(product: Pick<Product, 'brand' | 'model'>): string {
  return `${product.brand} ${product.model}`
}

// The collection position as a two-digit index:
// 1 becomes '01'. The number is the position, so this is the whole index.
export function formatProductIndex(number: number): string {
  return String(number).padStart(2, '0')
}

// The collection counter of one product: its position over the count,
// both two-digit, '01 / 02'.
export function formatProductCounter(number: number, count: number): string {
  return `${formatProductIndex(number)} / ${formatProductIndex(count)}`
}
