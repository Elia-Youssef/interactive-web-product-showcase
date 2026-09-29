import { describe, expect, it } from 'vitest'
import { ManifestError } from './errors'
import {
  driverHotspot,
  sampleOneManifest,
  sampleThreeManifest,
  sampleTwoManifest,
  graphiteFinish,
  sageFinish,
} from './fixtures'
import { parseProduct } from './parse'
import {
  DEFAULT_EXPLODE_CLIP,
  FINISHES_MIN,
  HOTSPOT_BULLETS_MAX,
  HOTSPOT_BULLETS_MIN,
  INTRO_MAX_LINES,
  RESERVED_HOTSPOT_IDS,
} from './rules'

type ManifestCase =
  | { readonly name: string, readonly manifest: unknown, readonly accepted: true, readonly slug: string }
  | { readonly name: string, readonly manifest: unknown, readonly accepted: false, readonly path: string }

const accepts = (name: string, manifest: unknown, slug: string): ManifestCase => ({
  name,
  manifest,
  accepted: true,
  slug,
})

const rejects = (name: string, manifest: unknown, path: string): ManifestCase => ({
  name,
  manifest,
  accepted: false,
  path,
})

const reservedId: string = RESERVED_HOTSPOT_IDS[0]
const line = (n: number) => Array.from({ length: n }, () => 'a line')

const cases: ManifestCase[] = [
  accepts('the full fixture', sampleOneManifest, 'sample-one'),
  accepts(
    'a manifest with empty intro, no hotspots and no optional fields',
    sampleTwoManifest,
    'sample-two',
  ),
  accepts(
    'a slug of letters, digits and hyphens',
    { ...sampleTwoManifest, slug: 'sample-2nd-gen' },
    'sample-2nd-gen',
  ),
  accepts(
    'an uppercase hex swatch',
    { ...sampleOneManifest, finishes: [sageFinish, { ...graphiteFinish, swatch: '#2B2E2C' }] },
    'sample-one',
  ),
  accepts(
    'bullets at the minimum',
    { ...sampleTwoManifest, hotspots: [{ ...driverHotspot, bullets: ['One line'] }] },
    'sample-two',
  ),
  accepts('an empty explode object, which defaults the clip', {
    ...sampleTwoManifest,
    explode: {},
  }, 'sample-two'),
  accepts('an empty camera object', { ...sampleTwoManifest, camera: {} }, 'sample-two'),
  accepts('a camera with only minDistance', sampleThreeManifest, 'sample-three'),
  rejects('an uppercase slug', { ...sampleTwoManifest, slug: 'Sample-Two' }, 'slug'),
  rejects('a slug with a leading hyphen', { ...sampleTwoManifest, slug: '-sample-two' }, 'slug'),
  rejects('a slug with a double hyphen', { ...sampleTwoManifest, slug: 'sample--two' }, 'slug'),
  rejects('a slug of the wrong type', { ...sampleTwoManifest, slug: 7 }, 'slug'),
  rejects('a zero product number', { ...sampleTwoManifest, number: 0 }, 'number'),
  rejects('a fractional product number', { ...sampleTwoManifest, number: 2.5 }, 'number'),
  rejects('a product number of the wrong type', { ...sampleTwoManifest, number: '2' }, 'number'),
  rejects('a category with leading whitespace', { ...sampleTwoManifest, category: ' Audio' }, 'category'),
  rejects('an empty brand', { ...sampleTwoManifest, brand: '' }, 'brand'),
  rejects('a model with a line break', { ...sampleTwoManifest, model: 'Two\nToo' }, 'model'),
  rejects('an eyebrow with trailing whitespace', { ...sampleTwoManifest, eyebrow: 'eyebrow ' }, 'eyebrow'),
  rejects('a tagline of the wrong type', { ...sampleTwoManifest, tagline: 42 }, 'tagline'),
  rejects('an intro over the line limit', {
    ...sampleTwoManifest,
    intro: line(INTRO_MAX_LINES + 1),
  }, 'intro'),
  rejects('an intro line with a line break', {
    ...sampleTwoManifest,
    intro: ['first', 'second\nthird'],
  }, 'intro[1]'),
  rejects('an intro line with leading whitespace', {
    ...sampleTwoManifest,
    intro: [' padded'],
  }, 'intro[0]'),
  rejects('a product without finishes', {
    ...sampleTwoManifest,
    finishes: line(FINISHES_MIN - 1),
  }, 'finishes'),
  rejects('a swatch that is not a hex color', {
    ...sampleOneManifest,
    finishes: [sageFinish, { ...graphiteFinish, swatch: 'green' }],
  }, 'finishes[1].swatch'),
  rejects('an empty finish variant', {
    ...sampleTwoManifest,
    finishes: [{ ...graphiteFinish, variant: '' }],
  }, 'finishes[0].variant'),
  rejects('a finish label with a line break', {
    ...sampleTwoManifest,
    finishes: [{ ...graphiteFinish, label: 'Graphite\nBlack' }],
  }, 'finishes[0].label'),
  rejects('a duplicated finish variant', {
    ...sampleOneManifest,
    finishes: [sageFinish, sageFinish],
  }, 'finishes[1].variant'),
  rejects('a duplicated finish label', {
    ...sampleOneManifest,
    finishes: [sageFinish, { ...sageFinish, variant: 'sage-alt' }],
  }, 'finishes[1].label'),
  rejects('a hotspot id with uppercase letters', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, id: 'Driver' }],
  }, 'hotspots[0].id'),
  rejects('a hotspot id with a hyphen', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, id: 'dri-ver' }],
  }, 'hotspots[0].id'),
  rejects('a reserved hotspot id', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, id: reservedId }],
  }, 'hotspots[0].id'),
  rejects('a duplicated hotspot id', {
    ...sampleTwoManifest,
    hotspots: [driverHotspot, driverHotspot],
  }, 'hotspots[1].id'),
  rejects('a hotspot without bullets', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, bullets: line(HOTSPOT_BULLETS_MIN - 1) }],
  }, 'hotspots[0].bullets'),
  rejects('a hotspot over the bullet limit', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, bullets: line(HOTSPOT_BULLETS_MAX + 1) }],
  }, 'hotspots[0].bullets'),
  rejects('a bullet with a line break', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, bullets: ['one', 'two', 'three\nfour'] }],
  }, 'hotspots[0].bullets[2]'),
  rejects('an empty hotspot title', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, title: '' }],
  }, 'hotspots[0].title'),
  rejects('a hotspot eyebrow with a line break', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, eyebrow: 'look\ncloser' }],
  }, 'hotspots[0].eyebrow'),
  rejects('an empty explode clip', {
    ...sampleTwoManifest,
    explode: { clip: '' },
  }, 'explode.clip'),
  rejects('an explode label with a line break', {
    ...sampleTwoManifest,
    explode: { label: 'See\ninside' },
  }, 'explode.label'),
  rejects('an unknown key inside explode', {
    ...sampleTwoManifest,
    explode: { nope: true },
  }, 'explode.nope'),
  rejects('a zero camera distance', {
    ...sampleTwoManifest,
    camera: { minDistance: 0 },
  }, 'camera.minDistance'),
  rejects('a negative camera distance', {
    ...sampleTwoManifest,
    camera: { maxDistance: -1 },
  }, 'camera.maxDistance'),
  rejects('equal camera distances', {
    ...sampleTwoManifest,
    camera: { minDistance: 1, maxDistance: 1 },
  }, 'camera.maxDistance'),
  rejects('a camera range with minDistance above maxDistance', {
    ...sampleTwoManifest,
    camera: { minDistance: 2, maxDistance: 1 },
  }, 'camera.maxDistance'),
  rejects('an unknown key on the manifest', { ...sampleTwoManifest, nope: true }, 'nope'),
  rejects('an unknown key inside a finish', {
    ...sampleTwoManifest,
    finishes: [{ ...graphiteFinish, nope: 1 }],
  }, 'finishes[0].nope'),
  rejects('an unknown key inside a hotspot', {
    ...sampleTwoManifest,
    hotspots: [{ ...driverHotspot, nope: 1 }],
  }, 'hotspots[0].nope'),
]

function manifestErrorThrown(manifest: unknown): ManifestError {
  try {
    parseProduct(manifest, 'test')
  } catch (error) {
    if (error instanceof ManifestError) {
      return error
    }
    throw error
  }
  throw new Error('expected the manifest to be rejected')
}

describe('parseProduct against the manifest schema', () => {
  for (const testCase of cases) {
    it(`${testCase.accepted ? 'accepts' : 'rejects'} ${testCase.name}`, () => {
      if (testCase.accepted) {
        expect(parseProduct(testCase.manifest, 'test').slug).toEqual(testCase.slug)
        return
      }
      const error = manifestErrorThrown(testCase.manifest)
      expect(error.issues.map((issue) => issue.path)).toContain(testCase.path)
      expect(error.message).toContain(testCase.path)
    })
  }
})

describe('the explode clip default', () => {
  it('fills in the default clip in the parsed output', () => {
    const product = parseProduct({ ...sampleOneManifest, explode: {} }, 'test')
    expect(product.explode?.clip).toEqual(DEFAULT_EXPLODE_CLIP)
  })

  it('leaves explode undefined when the manifest has none', () => {
    expect(parseProduct(sampleTwoManifest, 'test').explode).toBeUndefined()
  })

  it('keeps a given clip', () => {
    const product = parseProduct(sampleOneManifest, 'test')
    expect(product.explode).toEqual({ clip: 'Explode', label: 'See inside' })
  })
})
