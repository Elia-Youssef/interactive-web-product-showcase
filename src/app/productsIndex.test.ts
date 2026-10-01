import { expect, test } from 'vitest'
import { createCollection, type ProductInput } from '@lib/product'
import { productManifests } from '@products/index'

// The derived product index must be the product set itself: whatever
// manifest files carry the marker are in, each under its own slug, and the
// collection's own validation accepts them, so a manifest that ships is a
// manifest that parses. The test lives in the app layer because the products
// layer is data only: it imports no external package and reaches lib through
// types, so it cannot host a test file of its own.

// Every marker file of the products folder, keyed by its path: the oracle
// the index is held against. The file name carries the slug because the
// Node side finds a product's manifest by that name.
const markerFiles = import.meta.glob<ProductInput>('../products/*.manifest.ts', {
  eager: true,
  import: 'manifest',
})

test('the derived index holds every marker file, each named by its own slug', () => {
  const files = Object.entries(markerFiles)

  expect(files.length).toBeGreaterThan(0)
  expect(productManifests).toHaveLength(files.length)
  for (const [file, manifest] of files) {
    expect(file).toBe(`../products/${manifest.slug}.manifest.ts`)
    expect(productManifests).toContain(manifest)
  }
})

test('the collection accepts every manifest the index holds', () => {
  const collection = createCollection(productManifests)

  for (const manifest of productManifests) {
    expect(collection.bySlug(manifest.slug)?.slug).toBe(manifest.slug)
  }
})
