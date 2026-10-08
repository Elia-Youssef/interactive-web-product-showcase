// Cases for the optional per-product meta block: the strict shape and the
// single-line text rules of the link-preview words.
import { sampleOneManifest, sampleTwoManifest } from '../fixtures'
import { accepts, rejects, type ManifestCase } from './case'

export const metaCases: readonly ManifestCase[] = [
  accepts('a manifest without the meta block', sampleTwoManifest, 'sample-two'),
  accepts(
    'a manifest with kind and description',
    {
      ...sampleOneManifest,
      meta: { kind: 'over-ear headphone', description: 'A sample link-preview sentence.' },
    },
    'sample-one',
  ),
  rejects(
    'an empty kind',
    { ...sampleOneManifest, meta: { kind: '', description: 'd' } },
    'meta.kind',
  ),
  rejects(
    'a kind with a line break',
    { ...sampleOneManifest, meta: { kind: 'two\nlines', description: 'd' } },
    'meta.kind',
  ),
  rejects(
    'a kind with leading whitespace',
    { ...sampleOneManifest, meta: { kind: ' padded', description: 'd' } },
    'meta.kind',
  ),
  rejects(
    'a description with a line break',
    { ...sampleOneManifest, meta: { kind: 'k', description: 'two\nlines' } },
    'meta.description',
  ),
  rejects(
    'a description of the wrong type',
    { ...sampleOneManifest, meta: { kind: 'k', description: 3 } },
    'meta.description',
  ),
  rejects(
    'an unknown key inside the meta block',
    { ...sampleOneManifest, meta: { kind: 'k', description: 'd', title: 'extra' } },
    'meta.title',
  ),
]
