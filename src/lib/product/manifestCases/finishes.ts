// Cases for the finishes list: its minimum, each finish's fields, uniqueness
// of variants and labels, and unknown keys inside a finish.
import { graphiteFinish, sageFinish, sampleOneManifest, sampleTwoManifest } from '../fixtures'
import { FINISHES_MIN } from '../rules'
import { accepts, lines, rejects, type ManifestCase } from './case'

export const finishCases: readonly ManifestCase[] = [
  accepts(
    'an uppercase hex swatch',
    { ...sampleOneManifest, finishes: [sageFinish, { ...graphiteFinish, swatch: '#2B2E2C' }] },
    'sample-one',
  ),
  rejects(
    'a product without finishes',
    { ...sampleTwoManifest, finishes: lines(FINISHES_MIN - 1) },
    'finishes',
  ),
  rejects(
    'a swatch that is not a hex color',
    { ...sampleOneManifest, finishes: [sageFinish, { ...graphiteFinish, swatch: 'green' }] },
    'finishes[1].swatch',
  ),
  rejects(
    'an empty finish variant',
    { ...sampleTwoManifest, finishes: [{ ...graphiteFinish, variant: '' }] },
    'finishes[0].variant',
  ),
  rejects(
    'a finish label with a line break',
    { ...sampleTwoManifest, finishes: [{ ...graphiteFinish, label: 'Graphite\nBlack' }] },
    'finishes[0].label',
  ),
  rejects(
    'a duplicated finish variant',
    { ...sampleOneManifest, finishes: [sageFinish, sageFinish] },
    'finishes[1].variant',
  ),
  rejects(
    'a duplicated finish label',
    { ...sampleOneManifest, finishes: [sageFinish, { ...sageFinish, variant: 'sage-alt' }] },
    'finishes[1].label',
  ),
  rejects(
    'an unknown key inside a finish',
    { ...sampleTwoManifest, finishes: [{ ...graphiteFinish, nope: 1 }] },
    'finishes[0].nope',
  ),
]
