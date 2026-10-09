import { describe, expect, it } from 'vitest'
import type { ProductInput } from '@lib/product'
import type { ProductCollection } from '@lib/product'
import { productManifests } from '@products/index'
import { loadCollection, type CollectionResult } from './collection.logic'

// Local fixtures, not the real manifest: the loader is tested on its own
// contract, and the real list has its own gate below.
const validManifest = {
  slug: 'sample-one',
  number: 1,
  category: 'Audio',
  brand: 'Sample',
  model: 'One',
  eyebrow: 'Wireless over-ear headphones',
  tagline: 'Sound first, everything else second.',
  intro: ['A first line.', 'A second line.'],
  finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9db89d' }],
  hotspots: [],
} satisfies ProductInput

function readyCollection(result: CollectionResult): ProductCollection {
  if (result.kind !== 'ready') {
    throw new Error(`expected a ready collection, got ${result.kind}: ${result.error.message}`)
  }
  return result.collection
}

describe('loadCollection', () => {
  it('accepts a valid list and hands over the collection', () => {
    const collection = readyCollection(loadCollection([validManifest]))

    expect(collection.products).toHaveLength(1)
    expect(collection.first.slug).toBe('sample-one')
  })

  it('rejects an invalid list as the typed error, naming product and path', () => {
    const result = loadCollection([
      { ...validManifest, finishes: [{ ...validManifest.finishes[0], swatch: 'green' }] },
      validManifest,
    ])

    if (result.kind !== 'invalid') {
      throw new Error('expected the broken list to be rejected')
    }
    expect(result.error.problems).toEqual([
      {
        product: 'sample-one',
        path: 'finishes[0].swatch',
        message: 'expected a hex color in #RRGGBB form',
      },
    ])
  })

  it('collects every problem of a broken manifest in one error', () => {
    const result = loadCollection([
      {
        ...validManifest,
        finishes: [{ ...validManifest.finishes[0], swatch: 'green' }],
        taglines: 'an unknown key',
      },
      validManifest,
    ])

    if (result.kind !== 'invalid') {
      throw new Error('expected the broken list to be rejected')
    }
    expect(result.error.problems).toHaveLength(2)
    expect(result.error.problems.map((problem) => problem.path)).toEqual(
      expect.arrayContaining(['taglines', 'finishes[0].swatch']),
    )
  })
})

// The gate for every future manifest: the real list must validate, or the
// app fails at start by design.
describe('the real product manifest list', () => {
  it('validates into a collection', () => {
    const collection = readyCollection(loadCollection(productManifests))

    expect(collection.products).toHaveLength(productManifests.length)
  })

  it('opens on the product with the lowest number, carrying its own finishes', () => {
    const collection = readyCollection(loadCollection(productManifests))

    const lowest = Math.min(...productManifests.map((manifest) => manifest.number))
    const first = productManifests.find((manifest) => manifest.number === lowest)
    if (first === undefined) {
      throw new Error('the lowest number came from the manifest list itself')
    }
    expect(collection.first.slug).toBe(first.slug)
    expect(collection.first.number).toBe(first.number)
    expect(collection.first.category).toBe(first.category)
    expect(collection.first.finishes.map((finish) => finish.variant)).toEqual(
      first.finishes.map((finish) => finish.variant),
    )
  })
})
