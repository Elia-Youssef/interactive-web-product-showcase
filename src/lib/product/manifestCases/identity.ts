// Cases for the manifest's identity and copy fields: slug, number, the
// single-line text fields, intro, and unknown top-level keys.
import { sampleOneManifest, sampleTwoManifest } from '../fixtures'
import { INTRO_MAX_LINES } from '../rules'
import { accepts, lines, rejects, type ManifestCase } from './case'

export const identityCases: readonly ManifestCase[] = [
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
  rejects('an uppercase slug', { ...sampleTwoManifest, slug: 'Sample-Two' }, 'slug'),
  rejects('a slug with a leading hyphen', { ...sampleTwoManifest, slug: '-sample-two' }, 'slug'),
  rejects('a slug with a double hyphen', { ...sampleTwoManifest, slug: 'sample--two' }, 'slug'),
  rejects('a slug of the wrong type', { ...sampleTwoManifest, slug: 7 }, 'slug'),
  rejects('a zero product number', { ...sampleTwoManifest, number: 0 }, 'number'),
  rejects('a fractional product number', { ...sampleTwoManifest, number: 2.5 }, 'number'),
  rejects('a product number of the wrong type', { ...sampleTwoManifest, number: '2' }, 'number'),
  rejects(
    'a category with leading whitespace',
    { ...sampleTwoManifest, category: ' Audio' },
    'category',
  ),
  rejects('an empty brand', { ...sampleTwoManifest, brand: '' }, 'brand'),
  rejects('a model with a line break', { ...sampleTwoManifest, model: 'Two\nToo' }, 'model'),
  rejects(
    'an eyebrow with trailing whitespace',
    { ...sampleTwoManifest, eyebrow: 'eyebrow ' },
    'eyebrow',
  ),
  rejects('a tagline of the wrong type', { ...sampleTwoManifest, tagline: 42 }, 'tagline'),
  rejects(
    'an intro over the line limit',
    { ...sampleTwoManifest, intro: lines(INTRO_MAX_LINES + 1) },
    'intro',
  ),
  rejects(
    'an intro line with a line break',
    { ...sampleTwoManifest, intro: ['first', 'second\nthird'] },
    'intro[1]',
  ),
  rejects(
    'an intro line with leading whitespace',
    { ...sampleTwoManifest, intro: [' padded'] },
    'intro[0]',
  ),
  rejects('an unknown key on the manifest', { ...sampleTwoManifest, nope: true }, 'nope'),
]
