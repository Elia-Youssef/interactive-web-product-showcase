import { expect, test } from 'vitest'
import { createCollection } from '@lib/product'
import { productManifests } from '@products/index'

// The derived product index must be the product set itself: whatever
// manifest files carry the marker are in, and the collection's own
// validation accepts them, so a manifest that ships is a manifest that
// parses. The test lives in the app layer because the products layer is
// data only: it imports no external package and reaches lib through types,
// so it cannot host a test file of its own.
test('the derived index holds the shipped manifests and the collection accepts them', () => {
  const slugs = productManifests.map((manifest) => manifest.slug)

  expect(slugs).toContain('placeholder-speaker')
  const collection = createCollection(productManifests)
  expect(collection.bySlug('placeholder-speaker')?.slug).toBe('placeholder-speaker')
})
