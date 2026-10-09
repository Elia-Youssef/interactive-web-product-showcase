import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { ProductInput } from '@lib/product'
import { parseProduct, productEyebrowText } from '@lib/product'
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
  eyebrow: 'Compact speaker',
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

  expect(html).toContain('Compact speaker')
  expect(html).toContain('Sample')
  expect(html).toContain('Two')
  expect(html).toContain('Sound first, everything else second.')
  expect(html).toContain('A first line.')
  expect(html).toContain('A second line.')
})

test('the eyebrow is the manifest kind closed by the serial the site composes from the number', () => {
  const html = renderPanel()
  const product = parseProduct(sampleManifest, 'sample-one')

  // The serial is one marked fragment after the kind, and the paragraph's
  // text is the composed eyebrow: the number is written once, in the
  // manifest's number field.
  expect(html).toMatch(/<span class="[^"]*" data-eyebrow-tail="true">\/ 001<\/span>/)
  const paragraph = /<p class="[^"]*">((?:(?!<\/p>).)*data-eyebrow-tail(?:(?!<\/p>).)*)<\/p>/.exec(
    html,
  )
  const text = (paragraph?.[1] ?? '').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')
  expect(text).toBe(productEyebrowText(product))
  expect(text).toBe('Compact speaker / 001')
})

test('the finish list carries the site heading and one swatch per finish', () => {
  const html = renderPanel()

  expect(html).toContain('Choose your finish')
  expect(html).toContain('aria-label="Graphite"')
  expect(html).toContain('aria-label="Sage Green"')
})

test('the swatches are one single-choice radio group named by the site heading', () => {
  const html = renderPanel()

  expect(html).toContain('role="radiogroup"')
  expect(html).toContain('aria-label="Choose your finish"')
  expect((html.match(/role="radio"/g) ?? []).length).toBe(2)
})

test('the initial store state renders the product default as the checked finish', () => {
  const html = renderPanel()

  // What a static render can prove: the idle store, before any offer, and
  // its fallback to the product default, the first finish. Nothing here
  // reaches a store-driven state, because no effect runs in this render.
  expect(html).toContain('aria-checked="true"')
  expect(html).toContain('Graphite')
  expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
})

test('the explode toggle sits after the swatches, named by the manifest, disabled while detached', () => {
  const html = renderToString(
    <AppStoreProvider>
      <ProductPanel
        product={parseProduct(
          { ...sampleManifest, explode: { label: 'See inside' } },
          'sample-one',
        )}
      />
    </AppStoreProvider>,
  )

  // The manifest label is the accessible name. The static render runs no
  // effects, so the store holds no attached view and the toggle renders
  // disabled: a click before the model is presented cannot arm anything.
  // The swatch group precedes it, as the panel order has it.
  expect(html).toContain('role="radiogroup"')
  expect(html.indexOf('role="radiogroup"')).toBeLessThan(html.indexOf('See inside</button>'))
  expect(html).toContain('aria-pressed="false"')
  expect(html).toContain('disabled')
  expect(html).toContain('See inside</button>')
})

test('the scrub control sits under the toggle, named apart from it, disabled while detached', () => {
  const html = renderToString(
    <AppStoreProvider>
      <ProductPanel
        product={parseProduct(
          { ...sampleManifest, explode: { label: 'See inside' } },
          'sample-one',
        )}
      />
    </AppStoreProvider>,
  )

  // The slider follows the toggle and takes its accessible name from the
  // copy module's scrub name, the toggle's word plus what the slider
  // changes, so the section's two controls never share one name. The
  // static render runs no effects, so nothing is attached and nothing
  // publishes: the slider is disabled at the assembled rest and the
  // readout shows 0%.
  expect(html).toContain('type="range"')
  expect(html.indexOf('See inside</button>')).toBeLessThan(html.indexOf('type="range"'))
  expect(html).toContain('aria-label="See inside progress"')
  expect(html).toContain('value="0"')
  expect(html).toContain('aria-valuetext="0%"')
  expect(html).toContain('data-explode-readout')
  expect(html.match(/aria-valuetext/g)).toHaveLength(1)
  const slider = html.slice(html.indexOf('<input'))
  expect(slider).toContain('disabled')
})

test('a manifest without an explode label names the toggle by the site word', () => {
  const html = renderPanel()

  expect(html).toContain('Exploded view</button>')
})
