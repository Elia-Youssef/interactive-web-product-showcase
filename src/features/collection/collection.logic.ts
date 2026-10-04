import type { Product } from '@lib/product'
import { productName } from '@lib/product'

// The words of the collection navigation row, built from the site copy and
// the products it names. One definition per string, so the row and the
// specs that read it cannot drift apart.

// The accessible name of a previous or next link: the direction and the
// product it reaches, 'Previous: Sample Speaker'.
export function stepLabel(label: string, product: Pick<Product, 'brand' | 'model'>): string {
  return `${label}: ${productName(product)}`
}
