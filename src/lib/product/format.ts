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

// The digits of a product's serial, the number its panel eyebrow closes
// with: three, as the approved eyebrow copy spells it ('001'), apart from
// the two-digit collection index the counter and the index rows show.
export const PRODUCT_SERIAL_DIGITS = 3

// A product's serial: its collection number at the serial's digits, 1
// becomes '001'. Longer numbers pass through untouched, like the index.
export function formatProductSerial(number: number): string {
  return String(number).padStart(PRODUCT_SERIAL_DIGITS, '0')
}

// The product eyebrow in its two parts: the manifest's words, the product
// kind, and the tail the site appends from the product number, '/ 001'. The
// number is written once, in the manifest's number field, so the tail can
// never disagree with the counter, the index or a renumbering.
export function productEyebrow(product: Pick<Product, 'eyebrow' | 'number'>): {
  readonly lead: string
  readonly tail: string
} {
  return { lead: product.eyebrow, tail: `/ ${formatProductSerial(product.number)}` }
}

// The whole eyebrow text as the panel shows it, 'Compact speaker / 001':
// the lead and the tail joined by the one space the panel breaks at.
export function productEyebrowText(product: Pick<Product, 'eyebrow' | 'number'>): string {
  const { lead, tail } = productEyebrow(product)
  return `${lead} ${tail}`
}

// The accessible name of a previous or next link: the direction word and
// the product the step reaches, 'Previous: Sample Speaker'.
export function stepLabel(label: string, product: Pick<Product, 'brand' | 'model'>): string {
  return `${label}: ${productName(product)}`
}
