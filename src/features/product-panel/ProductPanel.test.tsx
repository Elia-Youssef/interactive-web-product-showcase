import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { ProductInput } from '@lib/product'
import { parseProduct } from '@lib/product'
import { AppStoreProvider } from '@store/index'
import { ProductPanel } from './ProductPanel'

// A static render proves the markup for the store's initial state and
// nothing else: renderToString reads zustand's initial server snapshot and
// runs no effects, so an offer or a selection made through the store is out
// of its reach. The store-driven behavior is covered by the slice tests,
// the panel logic tests and the e2e spec on the harness page.

// Neutral fixture words, never a real product's: the panel renders whatever the
// manifest says, and the real words belong to src/products/.
const sampleManifest = {
  slug: 'sample-one',
  number: 1,
  category: 'Audio',
  brand: 'Sample',
  model: 'Two',
  eyebrow: 'Compact speaker / 001',
  tagline: 'Sound first, everything else second.',
  intro: ['A first line.', 'A second line.'],
  finishes: [
    { variant: 'graphite', label: 'Graphite', swatch: '#2b2e2c' },
    { variant: 'sage', label: 'Sage Green', swatch: '#9db89d' },
  ],
  hotspots: [],
} satisfies ProductInput

function renderPanel(): string {
  return renderToString(
    <AppStoreProvider>
      <ProductPanel product={parseProduct(sampleManifest, 'sample-one')} />
    </AppStoreProvider>,
  )
}

test('the panel renders every word from the manifest', () => {
  const html = renderPanel()

  expect(html).toContain('Compact speaker / 001')
  expect(html).toContain('Sample')
  expect(html).toContain('Two')
  expect(html).toContain('Sound first, everything else second.')
  expect(html).toContain('A first line.')
  expect(html).toContain('A second line.')
})

test('the finish list carries the site heading and one swatch per finish', () => {
  const html = renderPanel()

  expect(html).toContain('Choose your finish')
  expect(html).toContain('aria-label="Graphite"')
  expect(html).toContain('aria-label="Sage Green"')
})

test('the initial store state renders the product default as the active finish', () => {
  const html = renderPanel()

  // What a static render can prove: the idle store, before any offer, and
  // its fallback to the product default, the first finish. Nothing here
  // reaches a store-driven state, because no effect runs in this render.
  expect(html).toContain('aria-pressed="true"')
  expect(html).toContain('Graphite')
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
})
