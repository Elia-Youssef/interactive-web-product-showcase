import { expect, test } from 'vitest'
import type { ProductInput } from '@lib/product'
import { parseProduct } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { createAppStore, selectSelectedVariant } from '@store/index'
import {
  activeFinish,
  explodeScrubName,
  explodeToggleLabel,
  formatExplodePercent,
} from '@lib/copy/productPanel'

// Neutral fixture words, never a real product's: the logic renders whatever the
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

// The exploded view's whole-percent table: halves round away from a
// misreading of the pose, so a value in the upper half of a percent reads
// as the percent it is inside of, and 1 is exactly 100%.
test.each([
  { progress: 0, expected: '0%' },
  { progress: 0.004, expected: '0%' },
  { progress: 0.005, expected: '1%' },
  { progress: 0.5, expected: '50%' },
  { progress: 0.995, expected: '100%' },
  { progress: 1, expected: '100%' },
])('formatExplodePercent($progress) is $expected', ({ progress, expected }) => {
  expect(formatExplodePercent(progress)).toBe(expected)
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

test('the toggle label is the manifest own word when the manifest names one', () => {
  const labeled = parseProduct(
    { ...sampleManifest, explode: { label: 'See inside' } },
    'sample-one',
  )

  expect(explodeToggleLabel(labeled)).toBe('See inside')
})

test('the toggle label falls back to the site word when the manifest names none', () => {
  // The schema normalizes the explode block, so a manifest without a label
  // parses with the block present and the label absent.
  expect(explodeToggleLabel(product)).toBe(siteCopy.defaultExplodeLabel)
})

test.each([
  { name: 'the manifest own word', labeled: true },
  { name: 'the site fallback word', labeled: false },
])('the scrub name is its own name apart from the toggle, over $name', ({ labeled }) => {
  const subject = labeled
    ? parseProduct({ ...sampleManifest, explode: { label: 'See inside' } }, 'sample-one')
    : product

  const toggle = explodeToggleLabel(subject)
  const scrub = explodeScrubName(subject)

  // The section's two controls never share one name, whatever word the
  // manifest chose: the slider's name says what it changes about the view.
  expect(scrub).not.toBe(toggle)
  expect(scrub).toBe(`${toggle} progress`)
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
