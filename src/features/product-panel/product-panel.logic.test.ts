import { expect, test } from 'vitest'
import type { ProductInput } from '@lib/product'
import { parseProduct } from '@lib/product'
import { createAppStore, selectSelectedVariant } from '@store/index'
import { activeFinish, formatProductIndex } from './product-panel.logic'

// Neutral fixture words, not the stand-in's: the logic renders whatever the
// manifest says, and the real words belong to src/products/.
const sampleManifest = {
  slug: 'sample-one',
  number: 1,
  category: 'Audio',
  brand: 'Sample',
  model: 'Two',
  eyebrow: 'Compact speaker / 001',
  tagline: 'Sound first, everything else second.',
  intro: [],
  finishes: [
    { variant: 'graphite', label: 'Graphite', swatch: '#2b2e2c' },
    { variant: 'sage', label: 'Sage Green', swatch: '#9db89d' },
  ],
  hotspots: [],
} satisfies ProductInput

const product = parseProduct(sampleManifest, 'sample-one')

// The index formatting table: single digits gain a leading zero, longer
// numbers pass through untouched.
test.each([
  { number: 1, expected: '01' },
  { number: 9, expected: '09' },
  { number: 10, expected: '10' },
  { number: 100, expected: '100' },
])('formatProductIndex($number) is $expected', ({ number, expected }) => {
  expect(formatProductIndex(number)).toBe(expected)
})

test('the active finish is the selected variant when the store holds one', () => {
  expect(activeFinish(product, 'sage')).toEqual({
    variant: 'sage',
    label: 'Sage Green',
    swatch: '#9db89d',
  })
})

test('the active finish is the product default, the first, while nothing is selected', () => {
  expect(activeFinish(product, null)).toEqual({
    variant: 'graphite',
    label: 'Graphite',
    swatch: '#2b2e2c',
  })
})

test('a selected variant the product does not offer is the programming error it is', () => {
  expect(() => activeFinish(product, 'graphitee')).toThrowError(/graphitee/)
})

// The cross-product pairs, over a real store: product A sits selected on a
// non-default variant while product B renders its first frame. The scoped
// selector must answer null for B, so B shows its own default. The second
// pair gives B a variant named like A's selection but not as B's default:
// that shared name is the case where a leak shows up as a wrong finish
// instead of a throw.
const finishFixtures = {
  graphite: { variant: 'graphite', label: 'Graphite', swatch: '#2b2e2c' },
  sage: { variant: 'sage', label: 'Sage Green', swatch: '#9db89d' },
  oak: { variant: 'oak', label: 'Oak', swatch: '#8a6a4f' },
  walnut: { variant: 'walnut', label: 'Walnut', swatch: '#4a3226' },
  ivory: { variant: 'ivory', label: 'Ivory', swatch: '#e8e4d8' },
}

function productWith(slug: string, finishes: readonly (typeof finishFixtures)['graphite'][]) {
  return parseProduct({ ...sampleManifest, slug, finishes }, slug)
}

const crossProductPairs = [
  {
    name: 'a product without the leaked variant name falls back to its default',
    first: productWith('pair-a', [finishFixtures.graphite, finishFixtures.sage]),
    second: productWith('pair-b', [finishFixtures.oak, finishFixtures.walnut]),
    expectedDefault: finishFixtures.oak,
  },
  {
    name: 'a shared variant name cannot leak: the second product keeps its default',
    first: productWith('pair-c', [finishFixtures.graphite, finishFixtures.sage]),
    second: productWith('pair-d', [
      finishFixtures.ivory,
      finishFixtures.sage,
      finishFixtures.walnut,
    ]),
    expectedDefault: finishFixtures.ivory,
  },
]

test.each(crossProductPairs)(
  '$name while the store still holds the first product selection',
  ({ first, second, expectedDefault }) => {
    const store = createAppStore()
    store.getState().finishOffered(
      first.slug,
      first.finishes.map((finish) => finish.variant),
    )
    store.getState().finishSelected(first.slug, 'sage')
    expect(selectSelectedVariant(store.getState(), first.slug)).toBe('sage')

    const selectedOnSecond = selectSelectedVariant(store.getState(), second.slug)

    expect(selectedOnSecond).toBeNull()
    expect(activeFinish(second, selectedOnSecond)).toEqual(expectedDefault)
  },
)
