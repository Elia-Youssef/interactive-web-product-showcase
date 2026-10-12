// The document title rule: '<what is shown> | <the collection name>'. Both
// spellings below are the same rule through one join, so the separator is
// defined once and a title change is one edit.

import { productName } from '@lib/product'
import type { Product } from '@lib/product'

function joinTitle(left: string, right: string): string {
  return `${left} | ${right}`
}

// A product page names the product first: 'Sample Speaker | Product Concepts'.
export function productDocumentTitle(
  product: Pick<Product, 'brand' | 'model'>,
  collectionName: string,
): string {
  return joinTitle(productName(product), collectionName)
}

// The collection page names the collection first, the studio second:
// 'Product Concepts | Rebel Art Studios'.
export function collectionDocumentTitle(collectionName: string, studioName: string): string {
  return joinTitle(collectionName, studioName)
}

// The not-found page names the state first: 'Not found | Product Concepts'.
export function notFoundDocumentTitle(state: string, collectionName: string): string {
  return joinTitle(state, collectionName)
}
