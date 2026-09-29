import { describe, expect, it } from 'vitest'
import { createCollection } from './collection'
import { CollectionError } from './errors'
import {
  sampleOneManifest,
  sampleThreeManifest,
  sampleTwoManifest,
  graphiteFinish,
  sageFinish,
} from './fixtures'

const EMPTY_MESSAGE = 'a collection needs at least one product'

function collectionErrorOf(rawManifests: readonly unknown[]): CollectionError {
  try {
    createCollection(rawManifests)
  } catch (error) {
    if (error instanceof CollectionError) {
      return error
    }
    throw error
  }
  throw new Error('expected the collection to be rejected')
}

describe('createCollection', () => {
  it('orders products by number regardless of the input order', () => {
    const collection = createCollection([sampleThreeManifest, sampleOneManifest, sampleTwoManifest])
    expect(collection.products.map((product) => product.number)).toEqual([1, 2, 3])
    expect(collection.first.slug).toEqual('sample-one')
  })

  it('looks up products by slug, hit and miss', () => {
    const collection = createCollection([sampleOneManifest, sampleTwoManifest])
    expect(collection.bySlug('sample-two')?.model).toEqual('Two')
    expect(collection.bySlug('nope')).toBeUndefined()
  })

  it('wraps neighbors around at both ends', () => {
    const collection = createCollection([sampleOneManifest, sampleTwoManifest, sampleThreeManifest])
    expect(collection.neighbors('sample-one')?.previous.slug).toEqual('sample-three')
    expect(collection.neighbors('sample-one')?.next.slug).toEqual('sample-two')
    expect(collection.neighbors('sample-two')?.previous.slug).toEqual('sample-one')
    expect(collection.neighbors('sample-two')?.next.slug).toEqual('sample-three')
    expect(collection.neighbors('sample-three')?.previous.slug).toEqual('sample-two')
    expect(collection.neighbors('sample-three')?.next.slug).toEqual('sample-one')
  })

  it('makes a one-product collection its own neighbor', () => {
    const collection = createCollection([sampleOneManifest])
    expect(collection.neighbors('sample-one')?.previous.slug).toEqual('sample-one')
    expect(collection.neighbors('sample-one')?.next.slug).toEqual('sample-one')
  })

  it('returns undefined neighbors for an unknown slug', () => {
    const collection = createCollection([sampleOneManifest])
    expect(collection.neighbors('nope')).toBeUndefined()
  })

  it('reports duplicate slugs', () => {
    const error = collectionErrorOf([sampleOneManifest, { ...sampleTwoManifest, slug: 'sample-one' }])
    expect(error.problems).toContainEqual({
      product: 'manifests[1]',
      path: 'slug',
      message: "duplicate slug 'sample-one'",
    })
    expect(error.message).toContain("duplicate slug 'sample-one'")
  })

  it('reports duplicate numbers', () => {
    const error = collectionErrorOf([sampleOneManifest, { ...sampleTwoManifest, number: 1 }])
    expect(error.problems).toContainEqual({
      product: 'manifests[1]',
      path: 'number',
      message: 'duplicate product number 1',
    })
  })

  it('reports an empty list', () => {
    const error = collectionErrorOf([])
    expect(error.problems).toEqual([{ product: null, path: null, message: EMPTY_MESSAGE }])
    expect(error.message).toContain(EMPTY_MESSAGE)
  })

  it('reports duplicate slugs and numbers together in one error', () => {
    const error = collectionErrorOf([
      sampleOneManifest,
      { ...sampleTwoManifest, slug: 'sample-one', number: 1 },
    ])
    expect(error.problems.map((problem) => problem.message)).toEqual([
      "duplicate slug 'sample-one'",
      'duplicate product number 1',
    ])
  })

  it('labels a broken manifest by its slug and names the field', () => {
    const error = collectionErrorOf([
      { ...sampleOneManifest, finishes: [{ ...graphiteFinish, swatch: 'green' }] },
    ])
    expect(error.problems).toContainEqual({
      product: 'sample-one',
      path: 'finishes[0].swatch',
      message: 'expected a hex color in #RRGGBB form',
    })
  })

  it('reports a broken manifest and a cross-product problem together', () => {
    const error = collectionErrorOf([
      { ...sampleThreeManifest, finishes: [{ ...sageFinish, swatch: 'nope' }] },
      sampleOneManifest,
      { ...sampleTwoManifest, number: 1 },
    ])
    expect(error.problems.map((problem) => problem.message)).toContain(
      'expected a hex color in #RRGGBB form',
    )
    expect(error.problems.map((problem) => problem.message)).toContain('duplicate product number 1')
  })
})
