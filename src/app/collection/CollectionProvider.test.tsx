import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { ProductInput } from '@lib/product'
import { AppStoreProvider } from '@store/index'
import { CollectionProvider } from './CollectionProvider'

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
} satisfies ProductInput

test('a valid list hands the collection to the children', () => {
  const html = renderToString(
    <AppStoreProvider>
      <CollectionProvider manifests={[validManifest]}>
        {(collection) => <p>{collection.first.slug}</p>}
      </CollectionProvider>
    </AppStoreProvider>,
  )

  expect(html).toContain('sample-one')
})

test('an invalid list renders the alert error screen instead of the children', () => {
  const html = renderToString(
    <AppStoreProvider>
      <CollectionProvider
        manifests={[
          { ...validManifest, finishes: [{ ...validManifest.finishes[0], swatch: 'nope' }] },
        ]}
      >
        {(collection) => <p>{collection.first.slug}</p>}
      </CollectionProvider>
    </AppStoreProvider>,
  )

  expect(html).toContain('role="alert"')
  expect(html).toContain('finishes[0].swatch')
  // The children never render: the error screen names the product by slug,
  // but no word of the manifest's content reaches the page.
  expect(html).not.toContain('Sound first')
})
