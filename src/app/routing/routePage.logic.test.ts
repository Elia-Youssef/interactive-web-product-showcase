import { describe, expect, test } from 'vitest'
import { parseProduct, type ProductCollection } from '@lib/product'
import { parseRoute } from '@lib/routing'
import { resolveRoutePage } from './routePage.logic'

const validManifest = {
  slug: 'sample-one',
  number: 1,
  category: 'Audio',
  brand: 'Sample',
  model: 'One',
  eyebrow: 'Wireless over-ear headphones',
  tagline: 'Sound first, everything else second.',
  intro: [],
  finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9db89d' }],
  hotspots: [],
} as const

const product = parseProduct(validManifest, 'test')

// A two-entry stand-in for the collection: the first product plus the
// bySlug lookup the resolution reads.
const collection: Pick<ProductCollection, 'first' | 'bySlug'> = {
  first: product,
  bySlug: (slug) => (slug === product.slug ? product : undefined),
}

describe('resolveRoutePage', () => {
  test('the root resolves to the first product', () => {
    expect(resolveRoutePage(parseRoute('/'), collection)).toEqual({
      kind: 'product',
      product,
    })
  })

  test('a known slug resolves to its product', () => {
    expect(resolveRoutePage(parseRoute('/p/sample-one'), collection)).toEqual({
      kind: 'product',
      product,
    })
  })

  test('an unknown slug resolves to the not-found page', () => {
    expect(resolveRoutePage(parseRoute('/p/does-not-exist'), collection)).toEqual({
      kind: 'notFound',
    })
  })

  test('an unknown path resolves to the not-found page', () => {
    expect(resolveRoutePage(parseRoute('/somewhere/else'), collection)).toEqual({
      kind: 'notFound',
    })
  })
})
