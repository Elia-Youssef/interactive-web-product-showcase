import { describe, expect, it } from 'vitest'
import { parseProduct, type Product } from '../../src/lib/product'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { MarkerViews } from './productMarkerViews'
import { selectFlowSubjects } from './flowSubjects'

// The selection of the flow proof's subjects, over fake products: the
// per-product close-up and plain lists, either possibly empty, the switch
// pairs by transition kind, and the set-level guards that fail when the
// whole set carries no hotspot of one kind or no camera-moving switch. The
// products are validated through the manifest schema, so the selection
// reads the real product shape.

// A fake product carrying one hotspot per given id, each with words unique
// to its id so the assertions read the subjects' own copy.
function fakeProduct(slug: string, hotspotIds: readonly string[]): Product {
  return parseProduct(
    {
      slug,
      number: 1,
      category: 'Audio',
      brand: 'Fake',
      model: 'Piece',
      eyebrow: `${slug} / 001`,
      tagline: `A fake piece for the selection proof of ${slug}.`,
      intro: [],
      finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9db89d' }],
      hotspots: hotspotIds.map((id) => ({
        id,
        eyebrow: 'A closer look',
        title: `the ${id} title`,
        bullets: [`the ${id} bullet`],
      })),
    },
    `${slug}.test`,
  )
}

const HOME_VIEW: AuthoredView = {
  position: [0, 0, 2],
  target: [0, 0, 0],
  fovY: 1,
  aspect: 16 / 9,
  near: 0.1,
  far: 10,
  azimuthDegrees: 0,
  polarDegrees: 90,
  distance: 2,
}

// A close-up view is distinguishable from the home view by its distance.
const CLOSE_UP_VIEW: AuthoredView = { ...HOME_VIEW, distance: 0.5 }

// The view facts of one fake product: the given ids are its close-ups.
function viewFactsOf(closeUpIds: readonly string[]): ProductCameraFacts {
  return {
    center: [0, 0, 0],
    stageBounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    home: HOME_VIEW,
    closeUps: new Map(closeUpIds.map((id) => [id, CLOSE_UP_VIEW])),
  }
}

function factsOf(products: readonly { slug: string; closeUps: readonly string[] }[]) {
  return new Map(products.map((product) => [product.slug, viewFactsOf(product.closeUps)]))
}

// Every view of every product shows every marker of its product: the
// selection then picks by kind alone.
function everyMarkerShown(
  products: readonly Product[],
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
): ReadonlyMap<string, MarkerViews> {
  return new Map(
    products.map((product) => {
      const all = new Set(product.hotspots.map((hotspot) => hotspot.id))
      const closeUps = [...(viewFactsBySlug.get(product.slug)?.closeUps.keys() ?? [])]
      return [product.slug, { home: all, closeUps: new Map(closeUps.map((id) => [id, all])) }]
    }),
  )
}

// Selects over a set where every view shows every marker.
function selectShown(
  products: readonly Product[],
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
) {
  return selectFlowSubjects(products, viewFactsBySlug, everyMarkerShown(products, viewFactsBySlug))
}

describe('selectFlowSubjects', () => {
  it('splits a mixed set per product and kind, in manifest order', () => {
    const products = [
      fakeProduct('mixed-piece', ['cu_a', 'pl_b']),
      fakeProduct('plain-piece', ['pl_c']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'mixed-piece', closeUps: ['cu_a'] },
      { slug: 'plain-piece', closeUps: [] },
    ])

    const subjects = selectShown(products, viewFactsBySlug)

    expect(subjects).toHaveLength(2)
    const [mixed, plain] = subjects
    expect(mixed?.closeUps.map((hotspot) => hotspot.id)).toEqual(['cu_a'])
    expect(mixed?.plains.map((hotspot) => hotspot.id)).toEqual(['pl_b'])
    expect(mixed?.closeUps[0]?.view).toBe(CLOSE_UP_VIEW)
    expect(plain?.closeUps).toEqual([])
    expect(plain?.plains.map((hotspot) => hotspot.id)).toEqual(['pl_c'])
  })

  it('carries the words of each hotspot and answers its view by id', () => {
    const products = [fakeProduct('wordy-piece', ['cu_a', 'pl_b'])]
    const viewFactsBySlug = factsOf([{ slug: 'wordy-piece', closeUps: ['cu_a'] }])

    const [subject] = selectShown(products, viewFactsBySlug)

    expect(subject?.closeUps[0]?.title).toBe('the cu_a title')
    expect(subject?.closeUps[0]?.eyebrow).toBe('A closer look')
    expect(subject?.closeUps[0]?.bullets).toEqual(['the cu_a bullet'])
    expect(subject?.plains[0]?.title).toBe('the pl_b title')
    expect(subject?.viewOf('cu_a')).toBe(CLOSE_UP_VIEW)
    expect(subject?.viewOf('pl_b')).toBeNull()
    expect(() => subject?.viewOf('no-such-hotspot')).toThrow(/no-such-hotspot/)
  })

  it('selects a set of single-hotspot products by their one kind', () => {
    const products = [
      fakeProduct('one-close-up', ['only_a']),
      fakeProduct('one-plain', ['only_b']),
      fakeProduct('pair-piece', ['cu_c', 'pl_d']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'one-close-up', closeUps: ['only_a'] },
      { slug: 'one-plain', closeUps: [] },
      { slug: 'pair-piece', closeUps: ['cu_c'] },
    ])

    const subjects = selectShown(products, viewFactsBySlug)

    expect(subjects[0]?.closeUps.map((hotspot) => hotspot.id)).toEqual(['only_a'])
    expect(subjects[0]?.plains).toEqual([])
    expect(subjects[1]?.closeUps).toEqual([])
    expect(subjects[1]?.plains.map((hotspot) => hotspot.id)).toEqual(['only_b'])
  })

  it('finds every switch kind wherever the manifest order carries the kinds', () => {
    const products = [
      fakeProduct('reversed-piece', ['pl_first', 'cu_second']),
      fakeProduct('twin-piece', ['cu_a', 'cu_b', 'pl_c']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'reversed-piece', closeUps: ['cu_second'] },
      { slug: 'twin-piece', closeUps: ['cu_a', 'cu_b'] },
    ])

    const subjects = selectShown(products, viewFactsBySlug)

    const [reversed, twin] = subjects
    expect(reversed?.switches).toEqual([
      { kind: 'close-up-to-plain', from: reversed?.closeUps[0], to: reversed?.plains[0] },
      { kind: 'plain-to-close-up', from: reversed?.plains[0], to: reversed?.closeUps[0] },
    ])
    expect(reversed?.switches[0]?.from.id).toBe('cu_second')
    expect(reversed?.switches[0]?.to.id).toBe('pl_first')
    expect(twin?.switches.map((pair) => pair.kind)).toEqual([
      'close-up-to-plain',
      'plain-to-close-up',
      'close-up-to-close-up',
    ])
    expect(twin?.switches[2]?.from.id).toBe('cu_a')
    expect(twin?.switches[2]?.to.id).toBe('cu_b')
  })

  it('excludes the plain to plain switch: the camera never moves for it', () => {
    const products = [
      fakeProduct('two-plain', ['pl_a', 'pl_b']),
      fakeProduct('mixed-piece', ['cu_a', 'pl_c']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'two-plain', closeUps: [] },
      { slug: 'mixed-piece', closeUps: ['cu_a'] },
    ])

    const subjects = selectShown(products, viewFactsBySlug)

    expect(subjects[0]?.plains.map((hotspot) => hotspot.id)).toEqual(['pl_a', 'pl_b'])
    expect(subjects[0]?.switches).toEqual([])
  })

  it('fails naming the plain kind when every hotspot of the set has a close-up', () => {
    const products = [fakeProduct('all-close-ups', ['a', 'b'])]
    const viewFactsBySlug = factsOf([{ slug: 'all-close-ups', closeUps: ['a', 'b'] }])

    expect(() => selectShown(products, viewFactsBySlug)).toThrow(/carries no plain hotspot/)
  })

  it('fails naming the close-up kind when no hotspot of the set has one', () => {
    const products = [fakeProduct('all-plain', ['a']), fakeProduct('also-plain', ['b'])]
    const viewFactsBySlug = factsOf([
      { slug: 'all-plain', closeUps: [] },
      { slug: 'also-plain', closeUps: [] },
    ])

    expect(() => selectShown(products, viewFactsBySlug)).toThrow(/carries no close-up hotspot/)
  })

  it('fails naming the missing switch when no pair in the set moves the camera', () => {
    const products = [
      fakeProduct('two-plain', ['pl_a', 'pl_b']),
      fakeProduct('one-close-up', ['cu_only']),
      fakeProduct('one-plain', ['pl_only']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'two-plain', closeUps: [] },
      { slug: 'one-close-up', closeUps: ['cu_only'] },
      { slug: 'one-plain', closeUps: [] },
    ])

    expect(() => selectShown(products, viewFactsBySlug)).toThrow(/carries no hotspot switch/)
  })

  it('fails naming the product when its view facts are missing', () => {
    const products = [fakeProduct('unfactured', ['a'])]

    expect(() => selectFlowSubjects(products, new Map(), new Map())).toThrow(/unfactured/)
  })

  it('takes a switch only when the first view shows the target marker', () => {
    const products = [fakeProduct('hidden-piece', ['cu_a', 'cu_b', 'cu_c', 'pl_d'])]
    const viewFactsBySlug = factsOf([{ slug: 'hidden-piece', closeUps: ['cu_a', 'cu_b', 'cu_c'] }])
    // cu_a's close-up shows only cu_c, cu_b's shows the plain marker, and
    // home shows no close-up marker but cu_c.
    const markerViewsBySlug = new Map<string, MarkerViews>([
      [
        'hidden-piece',
        {
          home: new Set(['cu_c', 'pl_d']),
          closeUps: new Map([
            ['cu_a', new Set(['cu_a', 'cu_c'])],
            ['cu_b', new Set(['cu_b', 'pl_d'])],
            ['cu_c', new Set(['cu_c'])],
          ]),
        },
      ],
    ])

    const [subject] = selectFlowSubjects(products, viewFactsBySlug, markerViewsBySlug)

    expect(subject?.switches.map((pair) => [pair.kind, pair.from.id, pair.to.id])).toEqual([
      ['close-up-to-plain', 'cu_b', 'pl_d'],
      ['plain-to-close-up', 'pl_d', 'cu_c'],
      ['close-up-to-close-up', 'cu_a', 'cu_c'],
    ])
  })

  it('offers no switch of a kind whose targets no first view shows', () => {
    const products = [
      fakeProduct('apart-piece', ['cu_a', 'cu_b']),
      fakeProduct('mixed-piece', ['cu_c', 'pl_d']),
    ]
    const viewFactsBySlug = factsOf([
      { slug: 'apart-piece', closeUps: ['cu_a', 'cu_b'] },
      { slug: 'mixed-piece', closeUps: ['cu_c'] },
    ])
    const markerViewsBySlug = new Map<string, MarkerViews>([
      [
        'apart-piece',
        {
          home: new Set(['cu_a', 'cu_b']),
          closeUps: new Map([
            ['cu_a', new Set(['cu_a'])],
            ['cu_b', new Set(['cu_b'])],
          ]),
        },
      ],
      ...everyMarkerShown(products.slice(1), viewFactsBySlug),
    ])

    const [apart] = selectFlowSubjects(products, viewFactsBySlug, markerViewsBySlug)

    expect(apart?.switches).toEqual([])
  })

  it('fails naming the product when its marker views are missing', () => {
    const products = [fakeProduct('unviewed', ['a'])]
    const viewFactsBySlug = factsOf([{ slug: 'unviewed', closeUps: ['a'] }])

    expect(() => selectFlowSubjects(products, viewFactsBySlug, new Map())).toThrow(/unviewed/)
  })
})
