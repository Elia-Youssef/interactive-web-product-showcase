import { describe, expect, test } from 'vitest'
import { collectionDocumentTitle, notFoundDocumentTitle, productDocumentTitle } from './title'

describe('productDocumentTitle', () => {
  test('names the brand, the model and the collection', () => {
    expect(productDocumentTitle({ brand: 'Sample', model: 'Speaker' }, 'Product Concepts')).toBe(
      'Sample Speaker | Product Concepts',
    )
  })
})

describe('collectionDocumentTitle', () => {
  test('names the collection and the studio', () => {
    expect(collectionDocumentTitle('Product Concepts', 'Rebel Art Studios')).toBe(
      'Product Concepts | Rebel Art Studios',
    )
  })
})

describe('notFoundDocumentTitle', () => {
  test('names the state and the collection', () => {
    expect(notFoundDocumentTitle('Not found', 'Product Concepts')).toBe(
      'Not found | Product Concepts',
    )
  })
})

describe('notFoundDocumentTitle', () => {
  test('names the state and the collection', () => {
    expect(notFoundDocumentTitle('Not found', 'Product Concepts')).toBe(
      'Not found | Product Concepts',
    )
  })
})
